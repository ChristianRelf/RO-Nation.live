import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getEventBySlug } from "@/lib/queries";
import { getUserSession } from "@/lib/session";
import { CheckoutProcessing } from "@/components/ticket/checkout-processing";
import { CheckoutNoScript } from "@/components/ticket/checkout-noscript";
import { GamePassCheckout } from "@/components/ticket/gamepass-checkout";
import { env } from "@/lib/env";
import { isPast } from "@/lib/format";
import { partnerBySlug } from "@/lib/partners/registry";
import { hasInventoryGrant } from "@/lib/roblox-tokens";
import { offersForEvent } from "@/lib/tickets/offers";
import { gamePassSalesAllowed, priceLabel } from "@/lib/tickets/pricing";
import { holdIsSpendable, seatPickerFor } from "@/lib/venue/picker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

// Checkout: where the order is actually placed.
//
// The reserve step chose a tier and accepted the terms; this page takes those,
// re-checks every one of them server-side, and then hands off to the modal that
// runs the reservation (components/ticket/checkout-processing.tsx).
//
// Everything below is re-validated even though the previous page already did it.
// The query string is not evidence of anything - it is just a URL somebody can
// type - so `?tier=<someone-else's-tier>&agreed=1` has to fail here rather than
// be believed. Belt and braces: the reservation action then re-resolves the tier
// against the event and re-checks the Robux gate a third time, under the row lock.
//
// This page is also where a Robux purchase will live. A payment is a round trip
// through Roblox, not a form submit, so it needs a page of its own to come back
// to - and that is this one.

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { tier?: string; agreed?: string; intent?: string };
}) {
  const event = await getEventBySlug(null, params.slug);
  if (!event) notFound();

  const reserveHref = `/events/${event.slug}/reserve`;

  const session = await getUserSession();
  if (!session) {
    redirect(`/account?returnTo=${encodeURIComponent(reserveHref)}`);
  }

  if (isPast(event.startsAt)) redirect(`/events/${event.slug}?error=past`);

  // Already holding one? Don't put them through a purchase animation for a ticket
  // they already have - show them the ticket.
  const existing = await prisma.ticket.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: session.uid } },
  });
  if (existing && existing.status !== "CANCELLED") {
    redirect(`/tickets/${existing.id}`);
  }

  // The terms were accepted on the reserve step. Reaching this page without that
  // means the step was skipped, so send them back to take it.
  if (searchParams.agreed !== "1") redirect(`${reserveHref}?error=terms`);

  // Resolve the requested tier against THIS event's real offers. An id from
  // another show, a deactivated one, or a sold-out one matches nothing here.
  const offers = await offersForEvent(event);
  const tierId = searchParams.tier ?? "";
  const offer = offers.find((o) => (o.id ?? "") === tierId);

  if (!offer) redirect(`${reserveHref}?error=badtier`);
  if (offer.blockedReason === "soldout") {
    redirect(`${reserveHref}?error=tier_soldout`);
  }
  // A priced tier while Robux is off. The reserve step already rendered it locked,
  // and the action would refuse it anyway - this is the middle of the three walls,
  // and it is the one that keeps a hand-typed URL out of the payment flow that
  // doesn't exist yet.
  if (offer.blockedReason === "locked") {
    redirect(`${reserveHref}?error=payments_off`);
  }

  // ---- The seat, on a seated show ----------------------------------------
  //
  // A hold is REQUIRED here when there is a seat to be had, and the reason is the same one
  // the game API's /purchase endpoint gives: you cannot sell a numbered chair to somebody
  // who has not said which chair. Without this, a bookmarked checkout URL would skip the map
  // entirely and be handed a seat by the allocator - not a bug, exactly, but it means the
  // one screen that exists to let a buyer choose can be walked straight past.
  //
  // seatPickerFor() is the same call the picker page makes, so "is there a seat to pick?"
  // is answered identically on both sides of the step - and a tier nobody drew a section
  // for skips this, exactly as it skips the map.
  const seats = await seatPickerFor(event, tierId);
  const seatsHref = `/events/${event.slug}/seats?tier=${encodeURIComponent(tierId)}&agreed=1`;

  if (seats.state === "broken") redirect(`${reserveHref}?error=unavailable`);

  const intentToken = searchParams.intent ?? "";

  if (seats.state === "pick") {
    // The token is not believed because it is in the URL. It is believed because it is a
    // PENDING hold, on this event, on this tier, belonging to the person asking - and if it
    // is not, they go back to the map rather than into a purchase animation. Note that an
    // EXPIRED hold passes: see holdIsSpendable().
    const ok = await holdIsSpendable({
      token: intentToken,
      eventId: event.id,
      tierId,
      userId: session.uid,
    });
    if (!ok) redirect(seatsHref);
  }

  // ---- The money, if there is any ----------------------------------------
  //
  // A priced tier is not reserved, it is BOUGHT - and on the web there is exactly one way to
  // do that: a game pass on roblox.com, which we can afterwards ask Roblox about. A Developer
  // Product cannot be prompted from a web page at all (it needs a game server's
  // ProcessReceipt), so a tier that only has one of those is not something this page can
  // sell - it is something the show sells, in-experience. That is what `payment_required`
  // has always said, and it is still true.
  //
  // Three keys have to agree before a pass is offered, and gamePassSalesAllowed() is where
  // they are read together: the master switch, the partner's own permission, and the
  // game-pass key - which exists separately because this rail needs the OAuth app to carry
  // the inventory scope, and the other two switches cannot possibly know whether it does.
  // Get that wrong and a buyer pays and we cannot verify it.
  if (offer.priceRobux > 0) {
    const canSellPass = gamePassSalesAllowed(
      partnerBySlug(event.partnerId),
      env.robuxTickets,
      env.robuxGamePass,
    );

    if (!canSellPass || !offer.gamePassId) {
      redirect(`${reserveHref}?error=payment_required`);
    }

    // Do they let us look? Read per request, and never cached: they can revoke it on
    // Roblox's own settings page at any moment, and the honest answer is the one that is
    // true now. It is one indexed read.
    const hasGrant = await hasInventoryGrant(session.uid);

    // Back to THIS page, with everything still in the query, once they have consented.
    const here = `/events/${event.slug}/checkout?tier=${encodeURIComponent(tierId)}&agreed=1${
      intentToken ? `&intent=${encodeURIComponent(intentToken)}` : ""
    }`;

    return (
      <GamePassCheckout
        eventId={event.id}
        tierId={tierId}
        tierName={offer.name}
        price={priceLabel(offer.priceRobux)}
        eventSlug={event.slug}
        eventTitle={event.title}
        intentToken={intentToken}
        hasGrant={hasGrant}
        consentHref={`/api/auth/roblox/consent?returnTo=${encodeURIComponent(here)}`}
        ticketBase="/tickets"
        reserveHref={reserveHref}
      />
    );
  }

  return (
    <div className="relative min-h-[70vh]">
      {/* The page under the modal. Deliberately quiet - it is a backdrop, and it
          is what you would see for the half-second before the dialog paints. */}
      <div className="shell flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
        <p className="kicker text-accent">Checkout</p>
        <h1 className="display mt-5 text-4xl sm:text-5xl">
          Completing your order
        </h1>
        <p className="mt-4 max-w-md text-muted">
          {event.title} · {offer.name} · {priceLabel(offer.priceRobux)}
        </p>
      </div>

      <CheckoutProcessing
        eventId={event.id}
        tierId={tierId}
        eventSlug={event.slug}
        eventTitle={event.title}
        tierName={offer.name}
        price={priceLabel(offer.priceRobux)}
        ticketBase="/tickets"
        reserveHref={reserveHref}
        // The hold. Empty on an unseated show, where there is nothing to hold - and NOT
        // trusted downstream either: issueTicket re-reads it under the lock and refuses it
        // if it is not this event's, this tier's and this person's.
        intentToken={intentToken}
        seatsHref={seats.state === "pick" ? seatsHref : undefined}
      />

      <CheckoutNoScript reserveHref={reserveHref} />
    </div>
  );
}

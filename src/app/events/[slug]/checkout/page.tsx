import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getEventBySlug } from "@/lib/queries";
import { getUserSession } from "@/lib/session";
import { CheckoutProcessing } from "@/components/ticket/checkout-processing";
import { CheckoutNoScript } from "@/components/ticket/checkout-noscript";
import { isPast } from "@/lib/format";
import { offersForEvent } from "@/lib/tickets/offers";
import { priceLabel } from "@/lib/tickets/pricing";

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
  searchParams: { tier?: string; agreed?: string };
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
      />

      <CheckoutNoScript reserveHref={reserveHref} />
    </div>
  );
}

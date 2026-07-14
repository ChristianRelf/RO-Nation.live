import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getEventBySlug } from "@/lib/queries";
import { getUserSession } from "@/lib/session";
import { CheckoutForm } from "@/components/ticket/checkout-form";
import { Kicker } from "@/components/ui";
import { isPast } from "@/lib/format";
import { offersForEvent } from "@/lib/tickets/offers";
import { anyAvailable } from "@/lib/tickets/pricing";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reserve ticket" };

const terms = [
  "Your ticket admits one person and is tied to your Roblox account - it can't be transferred or resold.",
  "Entry is verified in-experience at the door using your ticket code. Have it ready.",
  `${site.name} may cancel, reschedule, or change the line-up of any event.`,
  "You agree to follow Roblox Community Standards and event moderation while attending.",
  "Reserving a ticket you don't use may affect priority for future events.",
];

/** Refusals bounced back here by the checkout step. */
const ERRORS: Record<string, string> = {
  terms: "Please accept the ticket terms & conditions to continue.",
  badtier: "That ticket type isn't available for this show. Pick another.",
  tier_soldout: "That tier sold out while you were deciding. Pick another.",
  payments_off: "Paid tickets aren't switched on yet - that tier can't be issued.",
  // Robux cannot be charged from a web page - a real payment is a Developer
  // Product prompted inside the experience. So a paid tier is not something this
  // page can sell; it is something the show itself sells, at the door.
  payment_required:
    "Paid tiers are bought inside the experience, not here. Join the show and buy it in-game.",
  revoked: "Your ticket for this show was revoked. Contact the organisers.",
  unavailable: "We couldn't load the seat map for this show. Try again shortly.",
};

export default async function ReservePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  // `tier` is what the checkout modal hands back when a reservation fails, so a buyer
  // whose order fell over does not have to re-pick the ticket they had already chosen.
  // It is a HINT and nothing more - the form ignores it if that tier is no longer
  // takeable, and the checkout step re-resolves it against the event regardless.
  searchParams: { error?: string; tier?: string };
}) {
  const event = await getEventBySlug(null, params.slug);
  if (!event) notFound();

  const session = await getUserSession();
  if (!session) {
    redirect(
      `/account?returnTo=${encodeURIComponent(`/events/${params.slug}/reserve`)}`,
    );
  }

  if (isPast(event.startsAt)) redirect(`/events/${event.slug}?error=past`);

  // Already holding an active ticket? Go and look at it.
  //
  // This used to be how a SUCCESSFUL PURCHASE navigated: the action revalidated,
  // this page re-rendered, the buyer now held a ticket, and this redirect fired.
  // It was a clever trick and it is gone - checkout now owns the navigation, and
  // does it with a real `location.assign` once the reservation returns a code.
  // So this is back to meaning only what it says: you already have one.
  const existing = await prisma.ticket.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: session.uid } },
  });
  if (existing && existing.status !== "CANCELLED") {
    redirect(`/tickets/${existing.id}`);
  }

  const offers = await offersForEvent(event);
  // Nothing left that anybody could take - don't render a checkout whose every
  // option is dead. Sold out is the event page's news to break.
  if (!anyAvailable(offers)) redirect(`/events/${event.slug}?error=soldout`);

  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-56" />

      <div className="shell relative pt-16 sm:pt-20">
        <Link
          href={`/events/${event.slug}`}
          className="text-sm text-muted hover:text-fg"
        >
          ← Back to event
        </Link>
        <Kicker className="mt-6">Checkout</Kicker>
        <h1 className="display mt-5 text-4xl sm:text-5xl">Reserve your ticket</h1>
        <p className="mt-4 max-w-xl text-muted">
          Signed in as{" "}
          <span className="font-semibold text-fg">{session.displayName}</span>.
          Your ticket is issued to this Roblox account.
        </p>
      </div>

      <section className="shell py-10">
        {/* A SEATED show goes via the seat picker, and that is the whole of the wiring:
            this form is a plain GET, so where it points is where "Continue" goes. The
            picker hands the SAME query string on to checkout with a hold token added. A
            show with seatMode NONE - every show that exists today - points straight at
            checkout and is byte-for-byte untouched. */}
        <CheckoutForm
          eventTitle={event.title}
          startsAt={event.startsAt}
          venue={event.venue}
          offers={offers}
          terms={terms}
          checkoutHref={
            event.seatMode === "NONE"
              ? `/events/${event.slug}/checkout`
              : `/events/${event.slug}/seats`
          }
          preferTier={searchParams.tier}
          error={
            searchParams.error ? ERRORS[searchParams.error] : undefined
          }
        />
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { partnerBySlug } from "@/lib/partners/registry";
import { assertPartnerFeature } from "@/lib/partners/guard";
import { getEventBySlug } from "@/lib/queries";
import { getUserSession } from "@/lib/session";
import { CheckoutForm } from "@/components/ticket/checkout-form";
import { isPast } from "@/lib/format";
import { offersForEvent } from "@/lib/tickets/offers";
import { anyAvailable } from "@/lib/tickets/pricing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reserve ticket" };

type Params = { params: { slug: string; event: string } };

/** Refusals bounced back here by the checkout step. */
const ERRORS: Record<string, string> = {
  terms: "Please accept the ticket terms & conditions to continue.",
  badtier: "That ticket type isn't available for this show. Pick another.",
  tier_soldout: "That tier sold out while you were deciding. Pick another.",
  payments_off: "Paid tickets aren't switched on yet - that tier can't be issued.",
  payment_required:
    "Paid tiers are bought inside the experience, not here. Join the show and buy it in-game.",
  revoked: "Your ticket for this show was revoked. Contact the organisers.",
};

export default async function PartnerReservePage({
  params,
  searchParams,
  // `tier` is the choice the checkout modal hands back when a reservation fails, so a
  // buyer whose order fell over does not have to pick their ticket a second time. A hint
  // only: the form ignores a tier that is no longer takeable, and checkout re-resolves it
  // against the event regardless.
}: Params & { searchParams: { error?: string; tier?: string } }) {
  const partner = partnerBySlug(params.slug);
  if (!partner) notFound();
  // Tickets and shows only exist for a partner who HAS the events feature.
  // Without this the routes stand even when the nav hides them, and a route
  // that exists is a route somebody reaches.
  assertPartnerFeature(partner, "events");

  const event = await getEventBySlug(partner.slug, params.event);
  if (!event) notFound();

  const session = await getUserSession();
  if (!session) {
    redirect(
      `/account?returnTo=${encodeURIComponent(`/events/${params.event}/reserve`)}`,
    );
  }

  if (isPast(event.startsAt)) redirect(`/events/${event.slug}?error=past`);

  // Already holding an active ticket? Go and look at it. (This used to double as
  // the navigation for a successful purchase - checkout owns that now.)
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

  // The terms name the partner as the organiser, not RNL - they run the show,
  // and a ticket holder should know who they are actually dealing with. The
  // last line is the honest one: this is a fan event and the ticket is not a
  // ticket to anything the band is putting on.
  const terms = [
    `Your ticket admits one person and is tied to your Roblox account - it can't be transferred or resold.`,
    `Entry is verified in-experience at the door using your ticket code. Have it ready.`,
    `${partner.name} may cancel, reschedule, or change the line-up of any show.`,
    `You agree to follow Roblox Community Standards and event moderation while attending.`,
    `${partner.name} is an unofficial, fan-run event series. Your ticket admits you to a Roblox event staged by fans - it is not connected to the band or to any of their official events.`,
  ];

  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-56" />

      <div className="shell relative pt-16 sm:pt-20">
        <Link
          href={`/events/${event.slug}`}
          className="text-sm text-muted hover:text-fg"
        >
          ← Back to the show
        </Link>
        <p className="kicker mt-6 text-accent">Checkout</p>
        <h1 className="display mt-5 text-4xl sm:text-5xl">Reserve your ticket</h1>
        <p className="mt-4 max-w-xl text-muted">
          Signed in as{" "}
          <span className="font-semibold text-fg">{session.displayName}</span>.
          Your ticket is issued to this Roblox account.
        </p>
      </div>

      <section className="shell py-10">
        {/* Bare paths, because the browser is already on the partner's host and
            the middleware rewrites from there - see lib/partners/urls.ts. */}
        <CheckoutForm
          eventTitle={event.title}
          startsAt={event.startsAt}
          venue={event.venue}
          offers={offers}
          terms={terms}
          checkoutHref={`/events/${event.slug}/checkout`}
          preferTier={searchParams.tier}
          error={searchParams.error ? ERRORS[searchParams.error] : undefined}
        />
      </section>
    </div>
  );
}

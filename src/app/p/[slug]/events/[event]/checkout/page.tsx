import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { partnerBySlug } from "@/lib/partners/registry";
import { assertPartnerFeature } from "@/lib/partners/guard";
import { getEventBySlug } from "@/lib/queries";
import { getUserSession } from "@/lib/session";
import { CheckoutProcessing } from "@/components/ticket/checkout-processing";
import { isPast } from "@/lib/format";
import { offersForEvent } from "@/lib/tickets/offers";
import { priceLabel } from "@/lib/tickets/pricing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

// A partner's checkout. The same page as RNL's, scoped to the partner - and every
// link in it is a BARE path, because the browser is already on the partner's host
// and the middleware rewrites from there. Sending them to /tickets/<code> here
// lands them on the partner's ticket page, on the partner's domain, in the
// partner's brand. See lib/partners/urls.ts.

export default async function PartnerCheckoutPage({
  params,
  searchParams,
}: {
  params: { slug: string; event: string };
  searchParams: { tier?: string; agreed?: string };
}) {
  const partner = partnerBySlug(params.slug);
  if (!partner) notFound();
  assertPartnerFeature(partner, "events");

  const event = await getEventBySlug(partner.slug, params.event);
  if (!event) notFound();

  const reserveHref = `/events/${event.slug}/reserve`;

  const session = await getUserSession();
  if (!session) {
    redirect(`/account?returnTo=${encodeURIComponent(reserveHref)}`);
  }

  if (isPast(event.startsAt)) redirect(`/events/${event.slug}?error=past`);

  const existing = await prisma.ticket.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: session.uid } },
  });
  if (existing && existing.status !== "CANCELLED") {
    redirect(`/tickets/${existing.id}`);
  }

  // Re-checked here even though the reserve step already did. The query string is
  // not evidence - it is a URL anybody can type. See the note on RNL's checkout.
  if (searchParams.agreed !== "1") redirect(`${reserveHref}?error=terms`);

  const offers = await offersForEvent(event);
  const tierId = searchParams.tier ?? "";
  const offer = offers.find((o) => (o.id ?? "") === tierId);

  if (!offer) redirect(`${reserveHref}?error=badtier`);
  if (offer.blockedReason === "soldout") {
    redirect(`${reserveHref}?error=tier_soldout`);
  }
  if (offer.blockedReason === "locked") {
    redirect(`${reserveHref}?error=payments_off`);
  }

  return (
    <div className="relative min-h-[70vh]">
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
    </div>
  );
}

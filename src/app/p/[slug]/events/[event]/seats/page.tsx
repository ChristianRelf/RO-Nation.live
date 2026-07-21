import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { partnerBySlug } from "@/lib/partners/registry";
import { assertPartnerFeature } from "@/lib/partners/guard";
import { getEventBySlug } from "@/lib/queries";
import { getUserSession } from "@/lib/session";
import { SeatPicker } from "@/components/venue/seat-picker";
import { Kicker } from "@/components/ui";
import { isPast } from "@/lib/format";
import { offersForEvent } from "@/lib/tickets/offers";
import { priceLabel } from "@/lib/tickets/pricing";
import { seatPickerFor } from "@/lib/venue/picker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Choose your seat",
  robots: { index: false, follow: false },
};

// A partner's seat picker. The same page as RNL's, scoped to the partner - and every link
// in it is a BARE path, because the browser is already on the partner's host and the
// middleware rewrites from there. See lib/partners/urls.ts.

export default async function PartnerSeatsPage({
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
  const checkoutHref = `/events/${event.slug}/checkout`;

  const session = await getUserSession();
  if (!session) {
    redirect(`/account?returnTo=${encodeURIComponent(reserveHref)}`);
  }

  if (event.presale) redirect(`/events/${event.slug}`);
  if (isPast(event.startsAt)) redirect(`/events/${event.slug}?error=past`);

  const existing = await prisma.ticket.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: session.uid } },
  });
  if (existing && existing.status !== "CANCELLED") {
    redirect(`/tickets/${existing.id}`);
  }

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

  const onward = `${checkoutHref}?tier=${encodeURIComponent(tierId)}&agreed=1`;

  const picker = await seatPickerFor(event, tierId);
  if (picker.state === "skip") redirect(onward);
  if (picker.state === "broken") redirect(`${reserveHref}?error=unavailable`);

  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-56" />

      <div className="shell relative pt-16 sm:pt-20">
        <Link href={reserveHref} className="text-sm text-muted hover:text-fg">
          ← Back to tickets
        </Link>
        <Kicker className="mt-6">Checkout</Kicker>
        <h1 className="display mt-5 text-4xl sm:text-5xl">
          {picker.seatMode === "SEAT" ? "Choose your seat" : "Choose your area"}
        </h1>
        <p className="mt-4 max-w-xl text-muted">
          {picker.seatMode === "SEAT"
            ? "Pick a block, then a chair. We'll hold it for ten minutes while you check out."
            : "Pick where you want to be. We'll hold your place for ten minutes while you check out."}
        </p>
      </div>

      <section className="shell py-10">
        <SeatPicker
          eventId={event.id}
          layout={picker.layout}
          seatMode={picker.seatMode}
          tierId={tierId}
          tierName={offer.name}
          price={priceLabel(offer.priceRobux)}
          tiers={offers.map((o) => ({
            id: o.id ?? "",
            name: o.name,
            priceRobux: o.priceRobux,
          }))}
          availability={{
            taken: picker.availability.taken,
            held: picker.availability.held,
            sections: picker.availability.sections,
          }}
          checkoutHref={checkoutHref}
          reserveHref={reserveHref}
        />
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
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

// Between reserve and checkout: pick where you are sitting.
//
// The step EXISTS ONLY WHEN THERE IS A SEAT TO PICK. A show with seatMode NONE, an event
// with no map, a tier nobody drew a section for - all of them fall straight through to
// checkout, unchanged, which is what lets seating ship without touching a single show that
// already exists. seatPickerFor() makes that call, using the allocator's own rules.
//
// Everything the reserve step checked is checked again here. The query string is not
// evidence of anything - `?tier=<someone-else's>&agreed=1` is a URL anybody can type - and
// the hold action, and then issueTicket under the row lock, check it all a third and fourth
// time. This page decides what a person is SHOWN. It is not what decides what they get.

export default async function SeatsPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { tier?: string; agreed?: string };
}) {
  const event = await getEventBySlug(null, params.slug);
  if (!event) notFound();

  const reserveHref = `/events/${event.slug}/reserve`;
  const checkoutHref = `/events/${event.slug}/checkout`;

  const session = await getUserSession();
  if (!session) {
    redirect(`/account?returnTo=${encodeURIComponent(reserveHref)}`);
  }

  if (isPast(event.startsAt)) redirect(`/events/${event.slug}?error=past`);

  // Already holding one? A seat map is no use to them - they have a seat.
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

  // The query string rides ON to checkout, so a skipped picker is invisible to the buyer -
  // they simply go where they were always going.
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

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { partnerBySlug } from "@/lib/partners/registry";
import { getEventBySlug } from "@/lib/queries";
import { getUserSession } from "@/lib/session";
import { CheckoutForm } from "@/components/ticket/checkout-form";
import { isPast } from "@/lib/format";
import { offersForEvent } from "@/lib/tickets/offers";
import { anyAvailable } from "@/lib/tickets/pricing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reserve ticket" };

type Params = { params: { slug: string; event: string } };

export default async function PartnerReservePage({
  params,
  searchParams,
}: Params & { searchParams: { error?: string } }) {
  const partner = partnerBySlug(params.slug);
  if (!partner) notFound();

  const event = await getEventBySlug(partner.slug, params.event);
  if (!event) notFound();

  const session = await getUserSession();
  if (!session) {
    redirect(
      `/account?returnTo=${encodeURIComponent(`/events/${params.event}/reserve`)}`,
    );
  }

  if (isPast(event.startsAt)) redirect(`/events/${event.slug}?error=past`);

  // Already holding an active ticket? Go and look at it.
  //
  // This redirect is also how a SUCCESSFUL PURCHASE navigates, which is not a
  // coincidence and is worth knowing before you touch it. The reserve action
  // revalidates, this page re-renders as part of that, and by then the buyer
  // holds a ticket — so this fires, and lands them on it. That is exactly what
  // is wanted, and it is the only navigation that works: a *page* redirect is a
  // real HTTP 307 that the browser re-requests, so the middleware runs and a
  // partner's buyer reaches the partner's ticket page. A redirect from the
  // ACTION would not have (see app/actions/tickets.ts), and a client-side push
  // cannot either, because this very re-render unmounts the component that would
  // have to make it.
  //
  // Hence ?issued=1 here: it is what throws the confetti and says "Ticket
  // confirmed". The cost is that someone who types this URL while already
  // holding a ticket gets congratulated for it. That is a fair trade for the
  // purchase — the path everybody actually takes — being right, and it needs no
  // JavaScript to work at all.
  const existing = await prisma.ticket.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: session.uid } },
  });
  if (existing && existing.status !== "CANCELLED") {
    redirect(`/tickets/${existing.code}?issued=1`);
  }

  const offers = await offersForEvent(event);
  // Nothing left that anybody could take — don't render a checkout whose every
  // option is dead. Sold out is the event page's news to break.
  if (!anyAvailable(offers)) redirect(`/events/${event.slug}?error=soldout`);

  // The terms name the partner as the organiser, not RNL — they run the show,
  // and a ticket holder should know who they are actually dealing with. The
  // last line is the honest one: this is a fan event and the ticket is not a
  // ticket to anything the band is putting on.
  const terms = [
    `Your ticket admits one person and is tied to your Roblox account — it can't be transferred or resold.`,
    `Entry is verified in-experience at the door using your ticket code. Have it ready.`,
    `${partner.name} may cancel, reschedule, or change the line-up of any show.`,
    `You agree to follow Roblox Community Standards and event moderation while attending.`,
    `${partner.name} is an unofficial, fan-run event series. Your ticket admits you to a Roblox event staged by fans — it is not connected to the band or to any of their official events.`,
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
        <CheckoutForm
          eventId={event.id}
          eventTitle={event.title}
          startsAt={event.startsAt}
          venue={event.venue}
          offers={offers}
          terms={terms}
        />
      </section>
    </div>
  );
}

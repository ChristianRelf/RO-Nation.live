import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { partnerBySlug } from "@/lib/partners/registry";
import { assertPartnerFeature } from "@/lib/partners/guard";
import { getUserSession } from "@/lib/session";
import { TicketDetail } from "@/components/ticket/ticket-detail";
import { ticketBrand } from "@/lib/tickets/brand";
import { ticketCrowd } from "@/lib/tickets/crowd";
import { attendanceOrdinal } from "@/lib/tickets/history";
import { ticketSeal } from "@/lib/tickets/seal";
import { admissionWindow } from "@/lib/tickets/state";
import { eventUrl, ticketUrl } from "@/lib/origin";
import { venueMapFor } from "@/lib/venue/form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ticket" };

export default async function PartnerTicketDetailPage({
  params,
  searchParams,
}: {
  params: { slug: string; id: string };
  searchParams: { issued?: string };
}) {
  const partner = partnerBySlug(params.slug);
  if (!partner) notFound();
  // Tickets and shows only exist for a partner who HAS the events feature.
  // Without this the routes stand even when the nav hides them, and a route
  // that exists is a route somebody reaches.
  assertPartnerFeature(partner, "events");

  const session = await getUserSession();
  if (!session) redirect(`/account?returnTo=/tickets/${params.id}`);

  // Found by ID, not by code.
  //
  // The code is the thing this page WITHHOLDS until the holder activates - so it
  // cannot also be the thing in the address bar. Addressing the ticket by its own
  // opaque id is what makes the seal real rather than decorative: before you
  // activate, the code exists nowhere on the page, nowhere in the URL, and
  // nowhere in the markup.
  const ticket = await prisma.ticket.findUnique({
    where: { id: params.id },
    include: { event: true },
  });

  // Yours, AND for a show on this site. The second half matters: without it, an
  // RNL ticket code opens on the partner's host, rendering an RNL event in the
  // partner's brand. It is the visitor's own ticket either way - no data leaks -
  // but it belongs on the site whose show it admits them to.
  if (!ticket || ticket.userId !== session.uid) notFound();
  if (ticket.event.partnerId !== partner.slug) notFound();

  const brand = ticketBrand(partner.slug);

  // Only for a ticket that holds a seat, and scoped to THIS partner's maps. See RNL's copy
  // of this page for the long note.
  const holdsASeat = Boolean(ticket.seatKey || ticket.sectionKey);
  const map =
    holdsASeat && ticket.event.venueMapId
      ? await venueMapFor(ticket.event.venueMapId, partner.slug)
      : null;

  // Who else is coming. See RNL's copy of this page, and lib/tickets/crowd.ts.
  const crowd = await ticketCrowd(ticket.event.id, {
    live: admissionWindow(ticket.event).live,
  });

  // Their attendance across EVERY org, not just this partner's - the wallet has
  // always been one wallet, and "your 7th show" is a fact about the person.
  const milestone = ticket.checkedInAt
    ? await attendanceOrdinal(session.uid, ticket.checkedInAt)
    : null;

  return (
    <TicketDetail
      ticket={ticket}
      event={ticket.event}
      crowd={crowd}
      milestone={milestone}
      seatMap={
        map?.layout
          ? {
              layout: map.layout,
              seatKey: ticket.seatKey,
              sectionKey: ticket.sectionKey,
            }
          : undefined
      }
      holder={session.displayName}
      brandMark={brand.mark}
      brandName={brand.name}
      brandLogo={brand.logo}
      seal={ticketSeal(ticket.id, ticket.code)}
      ticketUrl={ticketUrl(ticket.id)}
      eventUrl={eventUrl(ticket.event.slug)}
      justIssued={searchParams.issued === "1"}
    />
  );
}

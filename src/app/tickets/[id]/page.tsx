import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/session";
import { TicketDetail } from "@/components/ticket/ticket-detail";
import { ticketBrand } from "@/lib/tickets/brand";
import { ticketSeal } from "@/lib/tickets/seal";
import { ticketUrl } from "@/lib/origin";
import { venueMapFor } from "@/lib/venue/form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ticket" };

export default async function TicketDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { issued?: string };
}) {
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
  if (!ticket || ticket.userId !== session.uid) notFound();

  const { event } = ticket;
  const brand = ticketBrand(event.partnerId);

  // The map, and ONLY for a ticket that actually holds a seat - so a door-check on an
  // unseated show, and every ticket page that exists today, costs exactly what it did
  // before seating landed. Same rule, same reason, as seatFor() in lib/tickets/verify.ts.
  //
  // A map that has since been deleted or will not parse comes back null, and the page
  // simply does not draw a picture. The ticket still SAYS where they sit - `seatLabel` is
  // frozen onto the row and owes nothing to the map still existing.
  const holdsASeat = Boolean(ticket.seatKey || ticket.sectionKey);
  const map =
    holdsASeat && event.venueMapId
      ? await venueMapFor(event.venueMapId, event.partnerId)
      : null;

  return (
    <TicketDetail
      ticket={ticket}
      event={event}
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
      justIssued={searchParams.issued === "1"}
    />
  );
}

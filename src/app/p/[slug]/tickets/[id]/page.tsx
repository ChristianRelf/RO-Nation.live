import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { partnerBySlug } from "@/lib/partners/registry";
import { assertPartnerFeature } from "@/lib/partners/guard";
import { getUserSession } from "@/lib/session";
import { TicketDetail } from "@/components/ticket/ticket-detail";
import { ticketBrand } from "@/lib/tickets/brand";
import { ticketSeal } from "@/lib/tickets/seal";
import { ticketUrl } from "@/lib/origin";

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
  // The code is the thing this page WITHHOLDS until the holder activates — so it
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
  // partner's brand. It is the visitor's own ticket either way — no data leaks —
  // but it belongs on the site whose show it admits them to.
  if (!ticket || ticket.userId !== session.uid) notFound();
  if (ticket.event.partnerId !== partner.slug) notFound();

  const brand = ticketBrand(partner.slug);

  return (
    <TicketDetail
      ticket={ticket}
      event={ticket.event}
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

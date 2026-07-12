import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { partnerBySlug } from "@/lib/partners/registry";
import { getUserSession } from "@/lib/session";
import { TicketDetail } from "@/components/ticket/ticket-detail";
import { ticketBrand } from "@/lib/tickets/brand";
import { ticketUrl } from "@/lib/origin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ticket" };

export default async function PartnerTicketDetailPage({
  params,
  searchParams,
}: {
  params: { slug: string; code: string };
  searchParams: { activated?: string; issued?: string };
}) {
  const partner = partnerBySlug(params.slug);
  if (!partner) notFound();

  const session = await getUserSession();
  if (!session) redirect(`/account?returnTo=/tickets/${params.code}`);

  const ticket = await prisma.ticket.findUnique({
    where: { code: params.code },
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
      ticketUrl={ticketUrl(ticket.code)}
      justIssued={searchParams.issued === "1"}
      justActivated={searchParams.activated === "1"}
    />
  );
}

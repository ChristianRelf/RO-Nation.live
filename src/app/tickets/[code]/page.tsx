import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/session";
import { TicketDetail } from "@/components/ticket/ticket-detail";
import { ticketBrand } from "@/lib/tickets/brand";
import { ticketUrl } from "@/lib/origin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ticket" };

export default async function TicketDetailPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { activated?: string; issued?: string };
}) {
  const session = await getUserSession();
  if (!session) redirect(`/account?returnTo=/tickets/${params.code}`);

  const ticket = await prisma.ticket.findUnique({
    where: { code: params.code },
    include: { event: true },
  });
  if (!ticket || ticket.userId !== session.uid) notFound();

  const { event } = ticket;
  const brand = ticketBrand(event.partnerId);

  return (
    <TicketDetail
      ticket={ticket}
      event={event}
      holder={session.displayName}
      brandMark={brand.mark}
      brandName={brand.name}
      ticketUrl={ticketUrl(ticket.code)}
      justIssued={searchParams.issued === "1"}
      justActivated={searchParams.activated === "1"}
    />
  );
}

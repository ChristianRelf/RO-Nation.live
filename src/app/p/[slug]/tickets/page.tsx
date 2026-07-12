import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { partnerBySlug } from "@/lib/partners/registry";
import { getUserSession } from "@/lib/session";
import { TicketWallet } from "@/components/ticket/ticket-wallet";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My tickets" };

export default async function PartnerTicketsPage({
  params,
}: {
  params: { slug: string };
}) {
  const partner = partnerBySlug(params.slug);
  if (!partner) notFound();

  const session = await getUserSession();
  if (!session) redirect("/account?returnTo=/tickets");

  // This partner's tickets only. Someone's RNL tickets are theirs to see on
  // ronation.live — showing them here would put another brand's shows inside
  // Sleep Token RO's wallet, which is confusing at best.
  const tickets = await prisma.ticket.findMany({
    where: { userId: session.uid, event: { partnerId: partner.slug } },
    include: { event: true },
    orderBy: { event: { startsAt: "asc" } },
  });

  return (
    <TicketWallet
      tickets={tickets}
      holder={session.displayName}
      browseLabel="Browse shows"
    />
  );
}

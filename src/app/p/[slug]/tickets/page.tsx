import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { partnerBySlug } from "@/lib/partners/registry";
import { assertPartnerFeature } from "@/lib/partners/guard";
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
  // Tickets and shows only exist for a partner who HAS the events feature.
  // Without this the routes stand even when the nav hides them, and a route
  // that exists is a route somebody reaches.
  assertPartnerFeature(partner, "events");

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

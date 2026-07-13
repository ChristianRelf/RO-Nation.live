import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/session";
import { TicketWallet } from "@/components/ticket/ticket-wallet";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My tickets" };

export default async function TicketsPage() {
  const session = await getUserSession();
  if (!session) redirect("/account?returnTo=/tickets");

  // Every ticket this account holds, RNL's and any partner's. ronation.live is
  // the one wallet that shows all of them — each stub carries the brand of the
  // show it admits you to, so a Sleep Token ticket still looks like one here.
  const tickets = await prisma.ticket.findMany({
    where: { userId: session.uid },
    include: { event: true },
    orderBy: { event: { startsAt: "asc" } },
  });

  return <TicketWallet tickets={tickets} holder={session.displayName} />;
}

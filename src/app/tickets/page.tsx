import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/session";
import { showsAttended } from "@/lib/tickets/history";
import { TicketWallet } from "@/components/ticket/ticket-wallet";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My tickets" };

export default async function TicketsPage() {
  const session = await getUserSession();
  if (!session) redirect("/account?returnTo=/tickets");

  // Every ticket this account holds, RNL's and any partner's. ronation.live is
  // the one wallet that shows all of them - each stub carries the brand of the
  // show it admits you to, so a Sleep Token ticket still looks like one here.
  const [tickets, attended] = await Promise.all([
    prisma.ticket.findMany({
      where: { userId: session.uid },
      include: { event: true },
      orderBy: { event: { startsAt: "asc" } },
    }),
    // Not derived from the list above: that is this site's tickets, and attendance
    // is a fact about the person. See lib/tickets/history.ts.
    showsAttended(session.uid),
  ]);

  return (
    <TicketWallet
      tickets={tickets}
      holder={session.displayName}
      attended={attended}
    />
  );
}

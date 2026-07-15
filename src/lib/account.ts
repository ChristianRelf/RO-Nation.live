import "server-only";
import type { Event, MemberNotification, Ticket } from "@prisma/client";
import { prisma } from "./db";
import { getDiscordLinkByUser } from "./discord-link";

// The member's own home. The analogue of lib/hub.ts - but hub.ts is the STAFF backstage
// launcher on the portal host, and this is the MEMBER surface on ronation.live. They do not
// share code and must not: nothing here is authorization, it is just a person's own things.
//
// Every read is user-scoped (by userId), never partner-scoped. That is deliberate and matches
// the ticket wallet (app/tickets/page.tsx): ronation.live is the one place that shows a member
// ALL their things - an RNL ticket and a Sleep Token ticket side by side - so scoping by
// partner here would be the bug, not the safeguard.

export type TicketWithEvent = Ticket & { event: Event };

export type AccountHome = {
  notifications: Pick<
    MemberNotification,
    "id" | "title" | "body" | "url" | "seenAt" | "createdAt"
  >[];
  unseenCount: number;
  upcoming: TicketWithEvent[];
  attended: TicketWithEvent[];
  watchlist: Event[];
  discord: { username: string | null } | null;
};

export async function getAccountHome(userId: string): Promise<AccountHome> {
  const now = new Date();

  const [notifications, unseenCount, upcoming, attended, follows, discord] =
    await Promise.all([
      // A record of recent change-notices, seen and unseen. The modal shows the unseen ones;
      // this is where they persist afterwards.
      prisma.memberNotification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          title: true,
          body: true,
          url: true,
          seenAt: true,
          createdAt: true,
        },
      }),
      prisma.memberNotification.count({ where: { userId, seenAt: null } }),
      // Tickets to shows still to come.
      prisma.ticket.findMany({
        where: {
          userId,
          status: { not: "CANCELLED" },
          event: { startsAt: { gte: now } },
        },
        include: { event: true },
        orderBy: { event: { startsAt: "asc" } },
        take: 5,
      }),
      // Shows they actually turned up to - derived from the door check-in.
      prisma.ticket.findMany({
        where: { userId, checkedInAt: { not: null } },
        include: { event: true },
        orderBy: { checkedInAt: "desc" },
        take: 10,
      }),
      // The watchlist. PUBLISHED only, so a show later pulled from sale drops out quietly
      // rather than linking to a dead page.
      prisma.eventFollow.findMany({
        where: { userId, event: { status: "PUBLISHED" } },
        include: { event: true },
        orderBy: { event: { startsAt: "asc" } },
      }),
      getDiscordLinkByUser(userId),
    ]);

  return {
    notifications,
    unseenCount,
    upcoming,
    attended,
    watchlist: follows.map((f) => f.event),
    discord: discord ? { username: discord.discordUsername } : null,
  };
}

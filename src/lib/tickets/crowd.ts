import "server-only";
import { prisma } from "@/lib/db";

// WHO ELSE IS COMING. The one number a ticket never mentioned.
//
// The event page has always counted holders - and then framed the count as
// INVENTORY: "412/2000" with a progress bar, which tells you how much is left
// rather than how many are coming. On a show with no capacity set it degrades to
// the bare string "Unlimited entry" and the count vanishes entirely, which is the
// wrong way round: a sold-out room and a huge room are both reasons to be excited,
// and only one of them was ever expressed.
//
// So this counts the CROWD, and the ticket page says it in those terms.
//
// ---- Why these are counts and not a findMany --------------------------------
//
// The attendees dashboard loads every ticket for a show with its user attached and
// filters in memory, which is fine for a staff page that was going to list them all
// anyway. This runs on a page that lists nobody, so it copies the other pattern in
// that folder - the three prisma.ticket.count() calls in /company/tickets - and
// makes the database do the counting. All three are served by existing indexes:
// @@index([eventId]) on tickets, @@index([eventId]) on event_follows.

export type Crowd = {
  /** Holding a live ticket. The headline: "1,247 going". */
  going: number;
  /**
   * Through the door RIGHT NOW.
   *
   * Only counted while doors are open - see the `live` argument. Outside that
   * window it is null and the caller says nothing, because "0 inside" on a show
   * three weeks away is not a fact anybody needs.
   */
  inside: number | null;
  /** Watching without a ticket. An indexed count nothing in the app has ever asked for. */
  watching: number;
};

export async function ticketCrowd(
  eventId: string,
  { live }: { live: boolean },
): Promise<Crowd> {
  const [going, watching, inside] = await Promise.all([
    prisma.ticket.count({
      // Cancelled is not "going", and it includes the revoked - they are cancelled
      // rows plus a stamp. Same rule the capacity count on the event page uses, so
      // the two numbers cannot drift apart.
      where: { eventId, status: { not: "CANCELLED" } },
    }),
    prisma.eventFollow.count({ where: { eventId } }),
    live
      ? prisma.ticket.count({ where: { eventId, status: "CHECKED_IN" } })
      : Promise.resolve(null),
  ]);

  return { going, watching, inside };
}

export type CrowdFace = { avatarUrl: string | null; displayName: string };

/**
 * A handful of the people going, for a face-pile. Avatars and display names only -
 * no ticket, no id, nothing that says which SEAT anybody has.
 *
 * ---- Why the newest holders, and why so few --------------------------------
 *
 * `createdAt desc` gives the "someone just grabbed a ticket" feel a face-pile is
 * for, and the small `take` is a privacy floor as much as a performance one: a pile
 * is a sense of a crowd, not a guest list. The caller (components/ticket/
 * crowd-facepile) refuses to render at all below a threshold, so no show with one
 * or two holders ever puts those one or two faces on a public page.
 *
 * Served by @@index([eventId]) on tickets - the same index the counts above use.
 */
export async function crowdFaces(eventId: string, take = 8): Promise<CrowdFace[]> {
  const holders = await prisma.ticket.findMany({
    where: { eventId, status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" },
    take,
    select: { user: { select: { displayName: true, avatarUrl: true } } },
  });
  return holders.map((h) => ({
    avatarUrl: h.user.avatarUrl,
    displayName: h.user.displayName,
  }));
}

/**
 * "1,247" - grouped, and deliberately not toLocaleString().
 *
 * Same reasoning as the note in lib/format.ts: this string is produced by a server
 * render and has to match the client's, and a locale-dependent thousands separator
 * is exactly the sort of thing that differs between the two.
 */
export function groupCount(n: number) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

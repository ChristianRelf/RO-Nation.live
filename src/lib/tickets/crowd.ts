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

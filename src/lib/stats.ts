import "server-only";
import { EventStatus, TicketStatus } from "@prisma/client";
import { prisma } from "./db";
import { getGroupMemberCount } from "./roblox-group";

// The numbers RO. Nation LIVE is allowed to print.
//
// ---- What this replaced ---------------------------------------------------
//
// A four-element array at the top of app/page.tsx:
//
//     { value: "40+",    label: "Shows produced"   }
//     { value: "120K+",  label: "Seats filled"     }
//     { value: "60+",    label: "Crew members"     }
//     { value: "4.9/5",  label: "Attendee rating"  }
//
// Not one of them came from anywhere. There is no ratings table in this schema and never
// has been, so the last one could not have been true even in principle - it was a number
// chosen because it looked like a good one.
//
// The galling part is that a hundred lines further down, the same page already did this
// properly: `past.reduce((sum, e) => sum + e.ticketsCount, 0)`, rendered as "N tickets
// checked in across our last M shows". A real number, counted from real rows, sitting
// directly beneath four invented ones. This file is that reduce, promoted.
//
// ---- The rule -------------------------------------------------------------
//
// EVERY NUMBER HERE IS COUNTED. Nothing is rounded up, nothing is estimated, and nothing
// has a "+" on it. A stat that cannot be counted is not softened - it is ABSENT, and
// every caller filters before it renders (see `statTiles`).
//
// That is why the type has a `number | null` in it. "0 shows" on a site that has run
// shows is a bug. A tile that simply is not there is a site that has not published its
// history yet, which is a true thing to say.

export type SiteStats = {
  /** Published RNL shows whose start time has passed. Shows we actually ran. */
  showsProduced: number;
  /** Live tickets on those shows: reserved or checked in, never cancelled. */
  ticketsIssued: number;
  /** People who came through a door. The strongest number on the list. */
  checkedIn: number;
  /** Roblox's own sales figure, synced not typed. See lib/merch/sync.ts. */
  merchSold: number;
  /** null when Roblox will not answer - see getGroupMemberCount. */
  groupMembers: number | null;
};

/**
 * Count everything, in parallel.
 *
 * ---- partnerId: null, on every single query in here ------------------------
 *
 * This is the one file where the scope will get forgotten, so it is stated once, loudly:
 * an unscoped count is not a query that fails. It is a query that puts Sleep Token's
 * shows, Sleep Token's tickets and Sleep Token's crowd into RNL's headline figures, and
 * looks perfectly healthy doing it. lib/queries.ts makes the scope a required first
 * argument precisely so it cannot be omitted; these are raw counts and have no such
 * protection, so the filter is written out every time even where it looks redundant.
 */
export async function getSiteStats(): Promise<SiteStats> {
  const past = {
    partnerId: null,
    status: EventStatus.PUBLISHED,
    startsAt: { lt: new Date() },
  };

  const [showsProduced, ticketsIssued, checkedIn, merch, groupMembers] =
    await Promise.all([
      prisma.event.count({ where: past }),

      // Tickets ON PAST SHOWS, not tickets in the database. A seat reserved for a show
      // that has not happened yet is not a seat that has been filled.
      prisma.ticket.count({
        where: { event: past, status: { not: TicketStatus.CANCELLED } },
      }),

      prisma.ticket.count({
        where: { event: past, status: TicketStatus.CHECKED_IN },
      }),

      // Roblox's number, not ours. MerchProduct.sales is synced from the group store, so
      // this is the one figure on the site that an outsider could independently verify by
      // opening the catalogue - which is exactly what makes it worth printing.
      //
      // Scoped to products that have actually synced: a row that has never been reached
      // has sales = 0 by default, and counting it would be counting a guess.
      prisma.merchProduct.aggregate({
        _sum: { sales: true },
        where: { syncedAt: { not: null } },
      }),

      getGroupMemberCount(),
    ]);

  return {
    showsProduced,
    ticketsIssued,
    checkedIn,
    merchSold: merch._sum.sales ?? 0,
    groupMembers,
  };
}

export type StatTile = { value: string; label: string };

/**
 * The stats worth showing, formatted, with the empty ones dropped.
 *
 * Shared by the homepage, /press and /company so the site cannot say one thing in the
 * shop window and another in the press kit.
 *
 * TWO RULES, and they are both about not embarrassing yourself:
 *
 *   1. A zero is dropped, not printed. On a young site most of these are zero, and a row
 *      of noughts under the hero reads as "nobody has ever come to one of these", which
 *      is a worse thing to say than nothing.
 *
 *   2. Fewer than two survivors and the whole strip is dropped by the caller. One lonely
 *      tile is not a stat strip, it is an orphan.
 */
export function statTiles(stats: SiteStats): StatTile[] {
  const n = (v: number) => v.toLocaleString("en-GB");

  return [
    { value: stats.showsProduced, label: "Shows produced" },
    // Door check-ins, not tickets issued: a reservation is an intention, a check-in is a
    // person who turned up. If nobody has ever been scanned through a door - which is the
    // case until the first show runs on this system - the tile is absent rather than 0.
    { value: stats.checkedIn, label: "Checked in at the door" },
    { value: stats.merchSold, label: "Merch sold on Roblox" },
    { value: stats.groupMembers ?? 0, label: "Group members" },
  ]
    .filter((t) => t.value > 0)
    .map((t) => ({ value: n(t.value), label: t.label }));
}

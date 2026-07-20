import "server-only";
import { EventStatus, TicketStatus } from "@prisma/client";
import { prisma } from "./db";

// How an org's shows are actually performing - reserved vs came, watch vs buy,
// the tier mix - for one scope at a time.
//
// ---- Scope, spelled the one honest way -------------------------------------
//
// `eventScope` is the `partnerId` value on Event/Ticket/EventFollow: NULL for RNL
// (SHASHA's own line-up) and the slug for a partner. It is read straight off the
// RosterScope the portal already resolved (lib/portal-scope.ts), so this file
// never has to know the "shasha"-the-string vs NULL-the-column trap - the scope
// object closed it once, upstream.
//
// Every count below therefore filters through the EVENT: a Ticket has no
// partnerId of its own, so `event: { partnerId: eventScope }` is the only correct
// way to ask "this org's tickets", and `partnerId: { in: [...] }`-style shortcuts
// are exactly the leak lib/stats.ts warns about. One org, counted as one org.
//
// ---- Every number is counted, never estimated ------------------------------
//
// Same rule as lib/stats.ts: a figure that cannot be counted cleanly is `null`
// and the caller drops the tile, rather than a 0 that reads as a claim. Attendance
// is only meaningful once a show has happened, so its rate is null until then;
// the watch→buy conversion is null when the follower set is too large to intersect
// cheaply, because a wrong number is worse than an absent one.

/** The cap on the follower set the conversion metric will intersect in memory. */
const CONVERSION_CAP = 5000;

export type TierSlice = { name: string; count: number };

export type ShowRow = {
  id: string;
  title: string;
  slug: string;
  startsAt: Date;
  status: EventStatus;
  /** 0 = unlimited. Render the count, never a bar. */
  capacity: number;
  /** Live (not cancelled) tickets. Includes the checked-in ones. */
  reserved: number;
  checkedIn: number;
  /** Following without a ticket-or-not: the watchlist count. */
  watching: number;
  /** checkedIn / reserved, PAST shows only. null for anything not yet run. */
  attendanceRate: number | null;
  tiers: TierSlice[];
};

export type ScopeAnalytics = {
  totals: {
    /** Published shows whose start has passed. Shows actually run. */
    showsPast: number;
    /** Published shows still to come. */
    upcoming: number;
    /** Live tickets across every one of this scope's shows. */
    ticketsLive: number;
    /** People through a door. The strongest number here. */
    checkedIn: number;
    /** checkedIn-on-past / live-on-past. null until a show has run. */
    attendanceRate: number | null;
    /** Total follows across this scope's shows - raw interest. */
    followers: number;
    /**
     * Of the people watching this scope's shows, the share who also hold a live
     * ticket to the same show. null when there are no followers, or when there
     * are more than CONVERSION_CAP of them (too many to intersect honestly-cheap).
     */
    conversion: number | null;
  };
  /** Recent shows, newest first. Capped - this is a dashboard, not an export. */
  shows: ShowRow[];
};

/** Recent shows to table. A dashboard, not the full line-up. */
const SHOWS_TAKEN = 12;

export async function getScopeAnalytics(
  eventScope: string | null,
): Promise<ScopeAnalytics> {
  const now = new Date();

  // The event-relation filter that scopes a Ticket/EventFollow to this org. NULL
  // matches RNL's own rows; a slug matches a partner's.
  const inScope = { partnerId: eventScope } as const;
  // Past PUBLISHED shows - the only place an attendance rate means anything.
  const pastShows = {
    partnerId: eventScope,
    status: EventStatus.PUBLISHED,
    startsAt: { lt: now },
  } as const;

  const [
    showsPast,
    upcoming,
    ticketsLive,
    checkedIn,
    livePast,
    checkedInPast,
    followers,
    recentEvents,
  ] = await Promise.all([
    prisma.event.count({ where: pastShows }),
    prisma.event.count({
      where: { partnerId: eventScope, status: EventStatus.PUBLISHED, startsAt: { gte: now } },
    }),
    prisma.ticket.count({
      where: { event: inScope, status: { not: TicketStatus.CANCELLED } },
    }),
    prisma.ticket.count({
      where: { event: inScope, status: TicketStatus.CHECKED_IN },
    }),
    // Attendance's denominator and numerator, over PAST shows only.
    prisma.ticket.count({
      where: { event: pastShows, status: { not: TicketStatus.CANCELLED } },
    }),
    prisma.ticket.count({
      where: { event: pastShows, status: TicketStatus.CHECKED_IN },
    }),
    prisma.eventFollow.count({ where: { event: inScope } }),
    prisma.event.findMany({
      where: { partnerId: eventScope },
      orderBy: { startsAt: "desc" },
      take: SHOWS_TAKEN,
      select: { id: true, title: true, slug: true, startsAt: true, status: true, capacity: true },
    }),
  ]);

  const shows = await perShow(recentEvents, now);
  const conversion = await watchToBuy(eventScope, followers);

  return {
    totals: {
      showsPast,
      upcoming,
      ticketsLive,
      checkedIn,
      attendanceRate: livePast > 0 ? checkedInPast / livePast : null,
      followers,
      conversion,
    },
    shows,
  };
}

/** Reserved, checked-in, watching and the tier mix for a set of shows, in three groupBys. */
async function perShow(
  events: {
    id: string;
    title: string;
    slug: string;
    startsAt: Date;
    status: EventStatus;
    capacity: number;
  }[],
  now: Date,
): Promise<ShowRow[]> {
  if (!events.length) return [];
  const ids = events.map((e) => e.id);

  const [tierRows, checkedInRows, followRows] = await Promise.all([
    // eventId × frozen tier name → the mix, and the per-event reserved total is
    // just the sum of its slices. tierName not tierId, so a renamed or deleted
    // tier still counts under the name it was sold as (same rule as the
    // attendees page).
    prisma.ticket.groupBy({
      by: ["eventId", "tierName"],
      where: { eventId: { in: ids }, status: { not: TicketStatus.CANCELLED } },
      _count: { _all: true },
    }),
    prisma.ticket.groupBy({
      by: ["eventId"],
      where: { eventId: { in: ids }, status: TicketStatus.CHECKED_IN },
      _count: { _all: true },
    }),
    prisma.eventFollow.groupBy({
      by: ["eventId"],
      where: { eventId: { in: ids } },
      _count: { _all: true },
    }),
  ]);

  const reserved = new Map<string, number>();
  const tiers = new Map<string, TierSlice[]>();
  for (const row of tierRows) {
    const n = row._count._all;
    reserved.set(row.eventId, (reserved.get(row.eventId) ?? 0) + n);
    const name = row.tierName ?? "General Admission";
    const list = tiers.get(row.eventId) ?? [];
    list.push({ name, count: n });
    tiers.set(row.eventId, list);
  }
  const checkedIn = new Map(checkedInRows.map((r) => [r.eventId, r._count._all]));
  const watching = new Map(followRows.map((r) => [r.eventId, r._count._all]));

  return events.map((e) => {
    const res = reserved.get(e.id) ?? 0;
    const seen = checkedIn.get(e.id) ?? 0;
    const isPast = e.startsAt.getTime() < now.getTime();
    return {
      id: e.id,
      title: e.title,
      slug: e.slug,
      startsAt: e.startsAt,
      status: e.status,
      capacity: e.capacity,
      reserved: res,
      checkedIn: seen,
      watching: watching.get(e.id) ?? 0,
      attendanceRate: isPast && res > 0 ? seen / res : null,
      tiers: (tiers.get(e.id) ?? []).sort((a, b) => b.count - a.count),
    };
  });
}

/**
 * The share of this scope's followers who also hold a live ticket to the show
 * they follow.
 *
 * Bounded on purpose: it pulls the follow rows (capped) and then reads tickets
 * only for THOSE users, so the second query can never be larger than the first.
 * Over the cap it returns null - the tile then simply does not appear, which is
 * the honest answer when the number cannot be produced cheaply.
 */
async function watchToBuy(
  eventScope: string | null,
  followerCount: number,
): Promise<number | null> {
  if (followerCount === 0 || followerCount > CONVERSION_CAP) return null;

  const follows = await prisma.eventFollow.findMany({
    where: { event: { partnerId: eventScope } },
    select: { eventId: true, userId: true },
  });
  if (!follows.length) return null;

  const userIds = [...new Set(follows.map((f) => f.userId))];
  const held = await prisma.ticket.findMany({
    where: {
      event: { partnerId: eventScope },
      userId: { in: userIds },
      status: { not: TicketStatus.CANCELLED },
    },
    select: { eventId: true, userId: true },
  });

  const key = (e: string, u: string) => `${e}:${u}`;
  const heldKeys = new Set(held.map((t) => key(t.eventId, t.userId)));
  const converted = follows.filter((f) => heldKeys.has(key(f.eventId, f.userId))).length;
  return converted / follows.length;
}

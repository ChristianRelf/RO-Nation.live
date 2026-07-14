import "server-only";
import type { Prisma } from "@prisma/client";
import type { Tier } from "@/lib/tickets/pricing";
import type { VenueLayout } from "@/lib/venue/schema";
import {
  bestAvailableOrder,
  parseSeatKey,
  seatLabelFor,
  sectionCapacity,
  sectionsForTier,
} from "@/lib/venue/seats";

// Who gets which chair.
//
// The ONE allocator. issueTicket() calls it, and nothing else does - which matters for
// the same reason issue.ts itself exists: two things that decide which seats are free
// eventually disagree, and the way you find out is that the picker offers a chair the
// checkout then refuses, forever, with both halves certain they are right.
//
// It runs INSIDE the caller's transaction, under the event row lock that issue.ts has
// already taken. That is what makes "is this seat free?" and "take this seat" a single
// serialised step per event. It takes a `tx` and not the global prisma client precisely
// so it cannot be called from outside one by accident.
//
// ---- The invariant this file and the database share ------------------------
//
//     A ticket's seatKey is NON-NULL IF AND ONLY IF that ticket holds that seat.
//
// Not "if and only if the ticket is live". The status does not come into it, and the
// queries below deliberately DO NOT filter on it.
//
// That is not an oversight, it is the whole design, and it follows from the constraint:
// @@unique([eventId, seatKey]) binds CANCELLED rows too (Postgres cannot express
// "unique among live rows" without a partial index, and `prisma db push` drops those -
// see the note on Ticket.seatKey). So a cancelled row with a seatKey still OWNS that
// seat as far as the database is concerned.
//
// If this file filtered on `status != CANCELLED`, it would hand out a seat the INSERT
// then bounces on the unique index - and the retry would recompute the same free seat,
// bounce again, and burn all five attempts before throwing. A chair nobody can ever buy,
// and a 500 for whoever tried.
//
// So cancellation NULLS the column instead (voidTicket() in issue.ts, cancelTicket() in
// app/actions/tickets.ts). That is what frees a seat, it is the only thing that frees a
// seat, and it is why this file can trust `seatKey IS NOT NULL` and nothing else.

export type SeatAssignment = {
  seatKey: string | null;
  sectionKey: string | null;
  seatLabel: string | null;
};

export type SeatOutcome =
  | ({ ok: true } & SeatAssignment)
  /**
   * They asked for a seat (or an area) and there is nothing left in this tier to give
   * them instead.
   *
   * Deliberately NOT folded into `tier_soldout`, even though it is a species of it. This
   * is the reason a paid buyer whose hold expired ends up with no ticket, and it is the
   * ONLY manual-refund case in the whole system - so it gets a name of its own, and that
   * name is what makes the "who is owed money" list a query rather than an investigation.
   */
  | { ok: false; reason: "seat_taken" };

const UNSEATED: SeatOutcome = {
  ok: true,
  seatKey: null,
  sectionKey: null,
  seatLabel: null,
};

export type ResolveSeatInput = {
  tx: Prisma.TransactionClient;
  eventId: string;
  seatMode: "NONE" | "SECTION" | "SEAT";
  /** The event's own cloned map. Null when it has none - which is most events. */
  layout: VenueLayout | null;
  tier: Tier;

  /** The seat they picked and are holding. Null = give them the best available. */
  wantSeat?: string | null;
  wantSection?: string | null;

  /**
   * THEIR OWN HOLD, which must not block them.
   *
   * The single easiest way to get this entire feature wrong: a buyer holds A1-K12, comes
   * back to spend it, and the allocator - reading every PENDING hold on the event - finds
   * A1-K12 held and refuses to sell it to them. They are blocked by themselves, and the
   * seat they are holding is the one seat they cannot have.
   */
  ignoreIntentId?: string | null;

  /**
   * THEIR OWN TICKET, which must not block them either.
   *
   * The upgrade case. Somebody holds GA in seat A1-K12 and buys VIP. The allocator looks
   * for a VIP seat, and their own GA ticket is sitting in the taken set - harmless, until
   * the VIP block overlaps or they are moving within one section, at which point they
   * collide with themselves. Same bug as above wearing a different hat.
   */
  ignoreTicketId?: string | null;
};

/**
 * Assign a seat, or an area, or neither.
 *
 * "Neither" is not a failure and is in fact the common case: NONE-mode events, and any
 * tier that nobody has drawn a section for. An UNMAPPED TIER SELLS EXACTLY AS IT DOES
 * TODAY - no seat, no section, the room's cap and the tier's cap and nothing else. That
 * is what lets a promoter map two of their three tiers and have the third keep working,
 * and it is why "the tier has no sections" returns success rather than an error.
 */
export async function resolveSeat(
  input: ResolveSeatInput,
): Promise<SeatOutcome> {
  const { tx, eventId, seatMode, layout, tier } = input;

  if (seatMode === "NONE" || !layout) return UNSEATED;

  return seatMode === "SEAT" ? seatMode_SEAT(input, layout) : seatMode_SECTION(input, layout);
}

// ---- What is already spoken for -------------------------------------------

/**
 * Every seat on this event that somebody holds - sold OR held mid-checkout.
 *
 * Two sources, and both are necessary:
 *
 *   tickets  the seat is SOLD. `seatKey IS NOT NULL` is the whole test - see the long
 *            note at the top about why status is not consulted.
 *
 *   intents  the seat is HELD: somebody is on roblox.com paying for it right now. A hold
 *            that has EXPIRED is not a hold, which is what `expiresAt > now` is doing -
 *            and it is why there is no sweeper job. A stale row simply stops counting.
 */
async function takenSeats(input: ResolveSeatInput): Promise<Set<string>> {
  const { tx, eventId, ignoreIntentId, ignoreTicketId } = input;

  const [sold, held] = await Promise.all([
    tx.ticket.findMany({
      where: {
        eventId,
        seatKey: { not: null },
        ...(ignoreTicketId ? { id: { not: ignoreTicketId } } : {}),
      },
      select: { seatKey: true },
    }),
    tx.purchaseIntent.findMany({
      where: {
        eventId,
        status: "PENDING",
        expiresAt: { gt: new Date() },
        seatKey: { not: null },
        ...(ignoreIntentId ? { id: { not: ignoreIntentId } } : {}),
      },
      select: { seatKey: true },
    }),
  ]);

  const taken = new Set<string>();
  for (const t of sold) if (t.seatKey) taken.add(t.seatKey);
  for (const h of held) if (h.seatKey) taken.add(h.seatKey);
  return taken;
}

/** How many people are already in each section - sold and held, same two sources. */
async function sectionLoad(input: ResolveSeatInput): Promise<Map<string, number>> {
  const { tx, eventId, ignoreIntentId, ignoreTicketId } = input;

  const [sold, held] = await Promise.all([
    tx.ticket.groupBy({
      by: ["sectionKey"],
      where: {
        eventId,
        sectionKey: { not: null },
        ...(ignoreTicketId ? { id: { not: ignoreTicketId } } : {}),
      },
      _count: { _all: true },
    }),
    tx.purchaseIntent.groupBy({
      by: ["sectionKey"],
      where: {
        eventId,
        status: "PENDING",
        expiresAt: { gt: new Date() },
        sectionKey: { not: null },
        ...(ignoreIntentId ? { id: { not: ignoreIntentId } } : {}),
      },
      _count: { _all: true },
    }),
  ]);

  const load = new Map<string, number>();
  const add = (key: string | null, n: number) => {
    if (key) load.set(key, (load.get(key) ?? 0) + n);
  };
  for (const g of sold) add(g.sectionKey, g._count._all);
  for (const g of held) add(g.sectionKey, g._count._all);
  return load;
}

// ---- SEAT mode -------------------------------------------------------------

async function seatMode_SEAT(
  input: ResolveSeatInput,
  layout: VenueLayout,
): Promise<SeatOutcome> {
  const { tier, wantSeat } = input;

  // Every seat this tier owns, in the order a human said to offer them. An empty list
  // means nobody drew a seated section for this tier - an unmapped tier, which sells as
  // general admission exactly as it always did.
  const order = bestAvailableOrder(layout, tier.id ?? null);
  if (order.length === 0) return UNSEATED;

  const taken = await takenSeats(input);

  // The seat they actually chose, if they may still have it. `order.includes` is doing
  // real work here and is not a formality: it proves the seat EXISTS, and that it belongs
  // to THIS TIER. Without it, a hand-typed seatKey buys a VIP chair at a GA price - and
  // the query string is not evidence of anything, as the checkout page already says.
  const chosen =
    wantSeat && order.includes(wantSeat) && !taken.has(wantSeat) ? wantSeat : null;

  // Otherwise the best one left. This is also the path a buyer takes when their hold
  // expired while they were away paying: they lose the chair they picked, not the ticket
  // they paid for.
  const seatKey = chosen ?? order.find((k) => !taken.has(k)) ?? null;
  if (!seatKey) return { ok: false, reason: "seat_taken" };

  return assignmentFor(layout, seatKey);
}

// ---- SECTION mode ----------------------------------------------------------

async function seatMode_SECTION(
  input: ResolveSeatInput,
  layout: VenueLayout,
): Promise<SeatOutcome> {
  const { tier, wantSection } = input;

  const sections = sectionsForTier(layout, tier.id ?? null);
  if (sections.length === 0) return UNSEATED;

  const load = await sectionLoad(input);

  const hasRoom = (key: string, capacity: number) => {
    // 0 = uncapped BY THE AREA. The tier's cap and the room's still apply on top, in
    // issue.ts. It does not mean "nobody may stand here" - reading it that way would
    // close every pit whose capacity nobody bothered to fill in.
    if (capacity <= 0) return true;
    return (load.get(key) ?? 0) < capacity;
  };

  // The one they picked first, then the rest in the authored order. A full gate falls
  // through to the next gate of the same tier rather than refusing - which is what a
  // festival with four entrances actually wants.
  const wanted = wantSection
    ? sections.find((s) => s.key === wantSection)
    : undefined;

  const candidates = wanted
    ? [wanted, ...sections.filter((s) => s.key !== wanted.key)]
    : sections;

  const picked = candidates.find((s) => hasRoom(s.key, sectionCapacity(s)));
  if (!picked) return { ok: false, reason: "seat_taken" };

  return {
    ok: true,
    seatKey: null, // you buy the pit, not a chair in it
    sectionKey: picked.key,
    seatLabel: seatLabelFor(picked, null),
  };
}

// ---- Naming it -------------------------------------------------------------

/**
 * Turn a seat key into what the ticket will SAY.
 *
 * Called once, at issue, and frozen onto the ticket - so the section's name at this
 * moment is the name the holder sees forever, whatever it is renamed to afterwards. Same
 * contract as tierName. See Ticket.seatLabel.
 */
function assignmentFor(layout: VenueLayout, seatKey: string): SeatOutcome {
  const parsed = parseSeatKey(seatKey);
  const section = layout.shapes.find((s) => s.key === parsed?.sectionKey);

  // Cannot happen: the key came out of bestAvailableOrder(), which built it from this
  // very layout. If it somehow does, refusing is the only safe answer - a seat we cannot
  // name is a seat we cannot print on a ticket or shout at a door.
  if (!parsed || !section || section.kind !== "SEATED_SECTION") {
    return { ok: false, reason: "seat_taken" };
  }

  return {
    ok: true,
    seatKey,
    sectionKey: parsed.sectionKey,
    seatLabel: seatLabelFor(section, parsed),
  };
}

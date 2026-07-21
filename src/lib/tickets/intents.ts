import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { isPast } from "@/lib/format";
import { partnerBySlug } from "@/lib/partners/registry";
import { resolveRobloxUser } from "@/lib/roblox-users";
import { randomString } from "@/lib/roblox";
import {
  effectiveTiers,
  gamePassSalesAllowed,
  robuxSalesAllowed,
} from "@/lib/tickets/pricing";
import { resolveSeat } from "@/lib/tickets/seating";
import { parseLayout, type VenueLayout } from "@/lib/venue/schema";
import { sectionCapacity, sectionsForTier } from "@/lib/venue/seats";

// The hold.
//
// Between "I picked that seat" and "I paid for it" there is a round trip through somebody
// else's website (a game pass page on roblox.com) or somebody else's game server (a
// ProcessReceipt handler). It takes seconds at best and minutes at worst, and for the
// whole of it the seat has to belong to nobody else. Without that, two people pay Robux
// for A1-K12 and exactly one of them gets it - and the other one has to be refunded by
// hand, by a human, who has to work out that it happened at all.
//
// A hold is not a lock. The LOCK is the event row (SELECT … FOR UPDATE), which this file
// takes for exactly the same reason issue.ts does, and which is what makes "is that seat
// held?" and "hold that seat" one serialised step per event.
//
// And a hold is not the last word either. The last word is Ticket's
// @@unique([eventId, seatKey]). If a hold is ever wrong, the ticket INSERT loses on a
// constraint rather than overselling a chair. This file is an optimisation on the buyer's
// experience. The unique index is the truth.
//
// ---- There is no sweeper, and no cron ------------------------------------
//
// An expired hold is not deleted. It simply stops counting: every reader filters on
// `expiresAt > now`, so a stale row is already invisible the microsecond it dies. Deleting
// it is housekeeping, not correctness - so it happens opportunistically, on the next write
// that happens to be passing (see the sweep in createPurchaseIntent), the same trick
// redeemTicket() uses on SsoTicket. Nothing has to be scheduled, and nothing breaks if it
// never runs.

/** How long a hold lasts. Ticketmaster gives you ten minutes; so do we. */
export const HOLD_MINUTES = 10;

export type IntentReason =
  | "not_found"
  | "unavailable"
  | "past"
  | "badtier"
  | "no_player"
  | "revoked"
  | "already_holds"
  | "soldout"
  | "tier_soldout"
  | "seat_taken"
  | "payments_off"
  /** The show is in presale - visible, but tickets are not on sale yet. */
  | "not_on_sale"
  /** A priced tier with no game pass and no dev product. Misconfigured, not sold out. */
  | "unsellable"
  /** Asked for a rail this tier does not offer. */
  | "bad_rail"
  /** A game pass cannot be gifted. See below - this is the whole rule. */
  | "cannot_gift";

export type IntentOutcome =
  | {
      ok: true;
      token: string;
      expiresAt: Date;
      priceRobux: number;
      seatKey: string | null;
      sectionKey: string | null;
      seatLabel: string | null;
      /** What the buyer is sent to. Exactly one of these is non-null, or neither if free. */
      gamePassId: string | null;
      devProductId: string | null;
    }
  | { ok: false; reason: IntentReason };

const fail = (reason: IntentReason) => ({ ok: false, reason }) as const;

/** Which rail the buyer is about to use. Null when the tier is free. */
export type Rail = "GAME_PASS" | "DEV_PRODUCT";

export type CreateIntentInput = {
  eventId: string;
  /** Who is PAYING. The website has a userId; a game booth has a robloxId. */
  payer: { userId: string } | { robloxId: string };
  /**
   * Who GETS the ticket. Omit for the ordinary case (it is the payer).
   *
   * Set it and you are buying for a friend - which is a Developer Product and nothing
   * else. See the refusal below.
   */
  beneficiaryRobloxId?: string | null;
  tierId?: string | null;
  seatKey?: string | null;
  sectionKey?: string | null;
  /** Null = they are not paying: a free tier, held only so the seat cannot be taken. */
  rail?: Rail | null;
  /** Same contract as issue.ts: undefined = don't scope, null = RNL's, slug = theirs. */
  scope?: string | null;
};

/**
 * Take a hold.
 *
 * Refusals are `reason`s, never throws - the callers are a web form and a game server, and
 * neither can do anything useful with a stack trace. Same contract as issueTicket().
 */
export async function createPurchaseIntent(
  input: CreateIntentInput,
): Promise<IntentOutcome> {
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: {
      id: true,
      partnerId: true,
      presale: true,
      seatMode: true,
      capacity: true,
      tiers: true,
      venueMap: { select: { layout: true } },
    },
  });
  if (!event) return fail("not_found");

  // An event outside the caller's scope is "not_found", full stop - never "not yours",
  // which would confirm it exists to somebody with no business knowing. Same rule, and
  // the same words, as issue.ts.
  const partnerId = event.partnerId ?? null;
  if (input.scope !== undefined && partnerId !== input.scope) {
    return fail("not_found");
  }

  // Presale: there is no seat to hold for a sale that has not opened. Refuse before we
  // reserve a chair for ten minutes for a purchase issue.ts is only going to refuse.
  if (event.presale) return fail("not_on_sale");

  const tiers = effectiveTiers(event.tiers);
  const tier = tiers.find((t) => (t.id ?? "") === (input.tierId ?? ""));
  if (!tier) return fail("badtier");

  const partner = partnerBySlug(partnerId);

  // ---- The money wall, again ---------------------------------------------
  //
  // Re-checked here even though issue.ts will check it again under the lock, because a
  // hold on a tier that can never be issued is a seat taken out of circulation for ten
  // minutes for a sale that cannot happen. The buyer would be sent to Roblox to pay for
  // something we are then going to refuse them.
  let rail: Rail | null = null;

  if (tier.priceRobux > 0) {
    if (!robuxSalesAllowed(partner, env.robuxTickets)) return fail("payments_off");

    if (!tier.gamePassId && !tier.devProductId) return fail("unsellable");

    rail = input.rail ?? null;
    if (!rail) return fail("bad_rail");

    if (rail === "GAME_PASS") {
      if (!tier.gamePassId) return fail("bad_rail");
      if (!gamePassSalesAllowed(partner, env.robuxTickets, env.robuxGamePass)) {
        return fail("payments_off");
      }
    }
    if (rail === "DEV_PRODUCT" && !tier.devProductId) return fail("bad_rail");
  }

  // ---- Who is paying, and who is getting in ------------------------------
  const payerId = await resolveUserId(input.payer);
  if (!payerId) return fail("no_player");

  let beneficiaryId = payerId;
  if (input.beneficiaryRobloxId) {
    const found = await resolveUserId({ robloxId: input.beneficiaryRobloxId });
    if (!found) return fail("no_player");
    beneficiaryId = found;
  }

  // A GAME PASS CANNOT BE GIFTED, and this one refusal is the entire rule.
  //
  // Roblox has no mechanism for it: a pass is bought BY somebody and lands in THEIR
  // inventory. So our ownership check - the thing that makes this rail verifiable at all -
  // would be asking Roblox about the wrong person, and would answer "no, they did not pay"
  // about somebody who definitely did. There is no way to make it work and no way to fake
  // it, so it is refused here, once, at the only door it can come through.
  //
  // Paid gifting is a Developer Product, bought inside the experience. A product is a
  // PAYMENT, not a possession, so ProcessReceipt can grant the ticket to anybody at all.
  if (rail === "GAME_PASS" && beneficiaryId !== payerId) return fail("cannot_gift");

  const layout = event.venueMap ? parseLayout(event.venueMap.layout) : null;

  // A seated event whose map does not parse. NOT a "no map, sell it as GA" - that would
  // put the whole room on sale a second time, over the top of everybody already holding a
  // seat. See the note on parseLayout(). Refuse, loudly.
  if (event.seatMode !== "NONE" && event.venueMap && !layout) {
    return fail("unavailable");
  }

  const token = randomString(32);
  const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000);

  try {
    return await prisma.$transaction(async (tx) => {
      // The same lock issue.ts takes, on the same row, for the same reason. Everybody
      // holding, reserving or paying for this event queues here - so no two people can
      // both read "A1-K12 is free" and both hold it.
      const rows = await tx.$queryRaw<
        { id: string; status: string; startsAt: Date; capacity: number }[]
      >`SELECT id, status, "startsAt", capacity FROM events WHERE id = ${event.id} FOR UPDATE`;

      const ev = rows[0];
      if (!ev || ev.status !== "PUBLISHED") return fail("unavailable");
      if (isPast(ev.startsAt)) return fail("past");

      // Already holding a ticket to this show? Then there is nothing to hold a seat for -
      // one ticket per person per event, always. The exception is a PURCHASE, which is an
      // upgrade and is allowed to want a better chair; that is issue.ts's problem, and it
      // does not need a hold to do it because the ticket is already theirs.
      const existing = await tx.ticket.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: beneficiaryId } },
        select: { status: true, revokedAt: true },
      });
      if (existing?.revokedAt) return fail("revoked");
      if (existing && existing.status !== "CANCELLED" && tier.priceRobux === 0) {
        return fail("already_holds");
      }

      // ---- One live hold per person, per event ----------------------------
      //
      // Cancelling their previous hold rather than refusing the new one, because changing
      // your mind about a seat is the single most ordinary thing a person does on a seat
      // map. Refuse, and going back to swap A1-K12 for A1-K13 leaves them holding BOTH for
      // ten minutes - so a browsing customer silently eats the room. It falls straight out
      // of one-ticket-per-person: you can only ever spend one of them anyway.
      await tx.purchaseIntent.updateMany({
        where: { eventId: event.id, userId: payerId, status: "PENDING" },
        data: { status: "CANCELLED" },
      });

      // The room's cap. Held seats count against it, which is the point: a room with three
      // left and three people at the checkout is a full room.
      if (ev.capacity > 0) {
        const [sold, held] = await Promise.all([
          tx.ticket.count({
            where: { eventId: event.id, status: { not: "CANCELLED" } },
          }),
          tx.purchaseIntent.count({
            where: {
              eventId: event.id,
              status: "PENDING",
              expiresAt: { gt: new Date() },
            },
          }),
        ]);
        if (sold + held >= ev.capacity) return fail("soldout");
      }

      // The tier's own cap, on top. The implicit tier has no id and no cap.
      if (tier.id && tier.capacity > 0) {
        const [sold, held] = await Promise.all([
          tx.ticket.count({
            where: {
              eventId: event.id,
              tierId: tier.id,
              status: { not: "CANCELLED" },
            },
          }),
          tx.purchaseIntent.count({
            where: {
              eventId: event.id,
              tierId: tier.id,
              status: "PENDING",
              expiresAt: { gt: new Date() },
            },
          }),
        ]);
        if (sold + held >= tier.capacity) return fail("tier_soldout");
      }

      // The seat. resolveSeat is the ONE allocator - the same function issue.ts calls when
      // the money actually lands, so the chair we promise here is the chair they get.
      const seat = await resolveSeat({
        tx,
        eventId: event.id,
        seatMode: event.seatMode,
        layout,
        tier,
        wantSeat: input.seatKey ?? null,
        wantSection: input.sectionKey ?? null,
        // Their own previous hold was just cancelled above, so it is already out of the
        // taken set - but their own TICKET is not, and an upgrade must not collide with
        // the GA seat they are sitting in.
        ignoreTicketId: null,
      });
      if (!seat.ok) return fail(seat.reason);

      const created = await tx.purchaseIntent.create({
        data: {
          token,
          eventId: event.id,
          tierId: tier.id,
          userId: payerId,
          beneficiaryUserId: beneficiaryId,
          seatKey: seat.seatKey,
          sectionKey: seat.sectionKey,
          rail,
          status: "PENDING",
          // Snapshots. The tier can be re-priced or deleted while the buyer is standing on
          // roblox.com, and none of that changes what they were quoted.
          priceRobux: tier.priceRobux,
          gamePassId: rail === "GAME_PASS" ? tier.gamePassId : null,
          expiresAt,
        },
        select: { token: true, expiresAt: true },
      });

      // Housekeeping, on the way past. Not correctness - every reader already ignores an
      // expired row. See the note at the top about why there is no cron.
      await tx.purchaseIntent.deleteMany({
        where: {
          eventId: event.id,
          status: { in: ["CANCELLED", "CONSUMED"] },
          createdAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) },
        },
      });

      return {
        ok: true as const,
        token: created.token,
        expiresAt: created.expiresAt,
        priceRobux: tier.priceRobux,
        seatKey: seat.seatKey,
        sectionKey: seat.sectionKey,
        seatLabel: seat.seatLabel,
        gamePassId: rail === "GAME_PASS" ? tier.gamePassId : null,
        devProductId: rail === "DEV_PRODUCT" ? tier.devProductId : null,
      };
    });
  } catch (err) {
    // Two holds racing for one seat: both passed resolveSeat, one committed. There is no
    // unique index on a hold's seat (a partial one would be needed, and db push drops
    // those), so this is not the usual constraint bounce - the lock is what prevents it,
    // and if the lock is ever bypassed the TICKET insert is still the backstop. Re-throw:
    // an error here is a real one.
    throw err;
  }
}

// ---- Reading a hold --------------------------------------------------------

/** The hold behind a token, if it is still worth anything. */
export async function findIntent(token: string) {
  if (!token) return null;
  return prisma.purchaseIntent.findUnique({
    where: { token },
    include: {
      event: { select: { id: true, slug: true, partnerId: true, placeId: true } },
      tier: { select: { id: true, name: true, priceRobux: true, gamePassId: true, devProductId: true } },
      beneficiary: { select: { id: true, robloxId: true, username: true } },
      user: { select: { id: true, robloxId: true, username: true } },
    },
  });
}

/**
 * Give a seat back.
 *
 * The player dismissed the purchase prompt, or closed the tab, or hit Back. Nothing breaks
 * if this is never called - the hold dies on its own in ten minutes - but calling it means
 * the next person sees the chair immediately instead of staring at a seat nobody wants.
 *
 * Scoped to the OWNER of the hold, so a token that leaks into a log cannot be used to
 * release somebody else's seat out from under them.
 */
export async function releaseIntent(token: string, userId: string) {
  await prisma.purchaseIntent.updateMany({
    where: { token, userId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
}

// ---- What is left ----------------------------------------------------------

export type SeatAvailability = {
  seatMode: "NONE" | "SECTION" | "SEAT";
  /** Seats that are SOLD. */
  taken: string[];
  /** Seats somebody is mid-checkout on. Shown differently, and they may come back. */
  held: string[];
  /** Live headcount per section - standing areas need a number, not a seat list. */
  sections: { key: string; taken: number; capacity: number }[];
};

/**
 * What is left, for the picker and for a game booth.
 *
 * DELIBERATELY NOT LOCKED, and that is not laziness.
 *
 * This runs on every page view of a hot show and on every poll of every ticket booth in
 * every server. Put it behind `SELECT … FOR UPDATE` and a thousand browsers queue behind
 * one person's checkout - the seat map would get slower the more people wanted seats,
 * which is precisely backwards.
 *
 * So it is a plain read, and it is SLIGHTLY STALE, and that is correct. A buyer may click a
 * seat that was taken half a second ago. What happens then is not a double-sale: it is
 * createPurchaseIntent taking the lock, finding the seat gone, and moving them to the next
 * best one. The staleness costs a buyer one surprise. It cannot cost anybody a chair,
 * because the lock and the unique index are downstream of it and neither is stale.
 */
export async function seatAvailability(eventId: string): Promise<SeatAvailability | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      seatMode: true,
      tiers: { select: { id: true } },
      venueMap: { select: { layout: true } },
    },
  });
  if (!event) return null;

  const [sold, held] = await Promise.all([
    prisma.ticket.findMany({
      where: { eventId, OR: [{ seatKey: { not: null } }, { sectionKey: { not: null } }] },
      select: { seatKey: true, sectionKey: true },
    }),
    prisma.purchaseIntent.findMany({
      where: {
        eventId,
        status: "PENDING",
        expiresAt: { gt: new Date() },
        OR: [{ seatKey: { not: null } }, { sectionKey: { not: null } }],
      },
      select: { seatKey: true, sectionKey: true },
    }),
  ]);

  const counts = new Map<string, number>();
  const bump = (k: string | null) => {
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  };
  for (const t of sold) bump(t.sectionKey);
  for (const h of held) bump(h.sectionKey);

  const layout: VenueLayout | null = event.venueMap
    ? parseLayout(event.venueMap.layout)
    : null;

  const sections = layout
    ? layout.shapes
        .filter((s) => s.kind === "SEATED_SECTION" || s.kind === "STANDING_AREA")
        .map((s) => ({
          key: s.key,
          taken: counts.get(s.key) ?? 0,
          capacity: sectionCapacity(s as any),
        }))
    : [];

  return {
    seatMode: event.seatMode,
    taken: sold.map((t) => t.seatKey).filter((k): k is string => Boolean(k)),
    held: held.map((h) => h.seatKey).filter((k): k is string => Boolean(k)),
    sections,
  };
}

// ---- Users -----------------------------------------------------------------

/**
 * Find, or create, the User a hold hangs off.
 *
 * Same job and same reasoning as resolveHolderUserId() in issue.ts: the website always has
 * a User (you cannot reach a checkout without signing in), and a game booth does NOT - the
 * player standing in front of it may never have opened ronation.live in their life.
 *
 * It is not shared with issue.ts's copy because that one is not exported, and exporting it
 * to save fifteen lines would couple the two files' idea of "who is this" together at
 * exactly the moment one of them needed to change. Two callers, one behaviour, written
 * down twice, on purpose.
 */
async function resolveUserId(
  who: { userId: string } | { robloxId: string },
): Promise<string | null> {
  if ("userId" in who) return who.userId;

  const robloxId = String(who.robloxId).trim();
  if (!/^\d{1,20}$/.test(robloxId)) return null;

  const existing = await prisma.user.findUnique({ where: { robloxId } });
  if (existing) return existing.id;

  const profile = await resolveRobloxUser(robloxId);
  if (!profile) return null;

  try {
    const created = await prisma.user.create({
      data: {
        robloxId,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        profileUrl: `https://www.roblox.com/users/${robloxId}/profile`,
      },
    });
    return created.id;
  } catch (err: any) {
    // Lost a race with another booth greeting the same first-time player. The row we were
    // about to write now exists and is exactly the row we wanted. Take theirs.
    if (err?.code === "P2002") {
      const raced = await prisma.user.findUnique({ where: { robloxId } });
      if (raced) return raced.id;
    }
    throw err;
  }
}

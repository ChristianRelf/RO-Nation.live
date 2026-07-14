import "server-only";
import type { PurchaseIntent } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { isPast } from "@/lib/format";
import { partnerBySlug } from "@/lib/partners/registry";
import { resolveRobloxUser } from "@/lib/roblox-users";
import { gamePassPurchaseId, ownsGamePass } from "@/lib/roblox-gamepass";
import { generateTicketCode } from "@/lib/utils";
import {
  effectiveTiers,
  gamePassSalesAllowed,
  robuxSalesAllowed,
} from "@/lib/tickets/pricing";
import { resolveSeat, type SeatAssignment } from "@/lib/tickets/seating";
import { parseLayout } from "@/lib/venue/schema";

// The one place that decides whether somebody GETS a ticket.
//
// Its sibling, verify.ts, decides whether a ticket gets somebody through the
// door. Between them they are the whole of ticketing, and both are shared by the
// website and the game API for the same reason: a checkout that oversells a room
// the door then turns people away from is worse than either one being wrong on
// its own. Two copies of a capacity check eventually disagree. There is one.
//
// Everything below runs inside a lock on the event row (SELECT … FOR UPDATE), so
// two people reserving the last seat at the same instant queue rather than both
// reading "1 left". That lock is the reason this file exists as a function and not
// as three copy-pasted transactions.
//
// ---- The three ways a ticket comes into existence -------------------------
//
//   reserve   The holder took it themselves. The website's checkout, and a game
//             server acting for a player who is standing in front of it. Free
//             tiers only.
//
//   gift      Somebody GAVE it to them - a giveaway bot, a crew comp, a player
//             buying one for a friend. May be a paid tier, and no money changes
//             hands: that is what a comp is. It is recorded on the ticket
//             (issuedBy…) so a VIP nobody paid for is never a mystery.
//
//   purchase  Somebody PAID for it, in Robux, inside the experience, as a Developer
//             Product. See the long note on TicketPurchase in schema.prisma - we
//             cannot verify that payment and we are not pretending to. What we can
//             do, and do, is refuse to honour the same PurchaseId twice.
//
//   game_pass Somebody PAID for it, in Robux, on roblox.com, in a browser - and this
//             is the one we can CHECK. A game pass is bought on Roblox's own site and
//             its ownership is readable back over Open Cloud, with the buyer's own
//             OAuth grant. So this mode does not believe anybody: it asks Roblox, and
//             the answer is the authority. See lib/roblox-gamepass.ts.

export type IssueReason =
  | "ok"
  /** No such event - or it is not this key's org's, which is the same answer. */
  | "not_found"
  /** The event exists but is not on sale: DRAFT or ARCHIVED. */
  | "unavailable"
  | "past"
  /** No such tier on this event, or it has been deactivated. */
  | "badtier"
  | "soldout"
  | "tier_soldout"
  /** Roblox does not know this player. */
  | "no_player"
  /** They were revoked from this show. A ban, not a full room. See below. */
  | "revoked"
  /** A priced tier, and Robux sales are off. Nobody can buy this today. */
  | "payments_off"
  /** A priced tier, reached by a path that collects no money. Use /purchase. */
  | "payment_required"
  /** /purchase, but the tier is free. Nothing to pay for - do not charge them. */
  | "not_purchasable"

  // ---- The hold, and the rail that can be checked ------------------------

  /** No such hold; someone else's; another show's; another tier's; already spent. */
  | "bad_intent"

  /**
   * The game-pass rail: Roblox says they do not own it.
   *
   * NOT AN ERROR, and the checkout must never render it as one. Roblox's inventory
   * lags a purchase by seconds, so this is the ordinary answer for the whole time a
   * buyer is walking back to our tab. It means "not yet". The UI says "waiting for
   * Roblox" and polls; it does not say "payment failed", because that is a lie that
   * would make people pay twice.
   */
  | "not_paid"

  /**
   * We could not ASK Roblox. Their 5xx, a timeout, a rotted grant.
   *
   * Kept apart from `not_paid` with some determination, because collapsing the two is
   * exactly the bug lib/merch/roblox.ts documents having shipped once already (a
   * rate-limited fetch that looked like "not clothing", and a shop that quietly lost a
   * shirt). Here the same collapse tells somebody who has just spent 500 Robux that
   * they did not pay. One means WAIT. The other means WE ARE BROKEN.
   */
  | "verify_unavailable"

  /**
   * They have never granted `user.inventory-item:read` - or they revoked it.
   *
   * A species of verify_unavailable whose fix is a BUTTON rather than a spinner, which
   * is the entire reason it is a separate word.
   */
  | "needs_consent"

  /**
   * The seat is gone and the tier has nothing to fall back to.
   *
   * When a fallback exists we take it silently - an expired hold costs you the chair
   * you picked, not the ticket you paid for. This fires ONLY when the whole tier is
   * full, which makes it the one and only manual-refund case in the system.
   */
  | "seat_taken";

export type IssueOutcome =
  | {
      ok: true;
      ticketId: string;
      /**
       * True when no new ticket was created - they already held one, or this was
       * a PurchaseId we had already honoured.
       *
       * The caller needs this and must not treat it as a failure. A game server
       * retrying a dropped /purchase call gets `existing: true` and the ticket it
       * paid for, which is precisely what a retry should get.
       */
      existing: boolean;
    }
  | { ok: false; reason: Exclude<IssueReason, "ok"> };

const fail = (reason: Exclude<IssueReason, "ok">) =>
  ({ ok: false, reason }) as const;

/** How the ticket is being handed over. See the note above. */
export type IssueMode =
  | { kind: "reserve"; intentToken?: string | null }
  | {
      kind: "gift";
      /** Who gave it. A Roblox id - a player, or a crew member. */
      byRobloxId: string;
      byName: string;
    }
  | {
      kind: "purchase";
      /** Roblox's own PurchaseId, from ProcessReceipt. The idempotency key. */
      purchaseId: string;
      robuxSpent: number;
      placeId?: string | null;
      productId?: string | null;
      /** The key that asserted the payment. The audit trail for that assertion. */
      apiKeyId?: string | null;
      /**
       * The hold this receipt settles, when the buy started on the web (or at a booth
       * that took a seat first).
       *
       * REQUIRED on a seated show, and refused without it - you cannot sell a numbered
       * seat on the word of a game server that has no idea which seat. Optional on an
       * unseated one, so every existing in-experience and at-the-door flow keeps
       * working exactly as it does today.
       */
      intentToken?: string | null;
    }
  /**
   * The game-pass rail. The only one on this list we can VERIFY.
   *
   * Look at what it carries: a token, and NOTHING else. Not the pass id, not the price,
   * not the seat, not the buyer. Every one of those is re-read from the database inside
   * this function - the tier's own gamePassId, the intent's own beneficiaryUserId and
   * seatKey - and that is not tidiness, it is the security property.
   *
   * A caller who could NAME the pass could name a pass they already own, and walk out
   * with a free VIP ticket, verified, with our own ownership check waving them through.
   * So the caller names a hold, and the hold names everything else.
   */
  | { kind: "game_pass"; intentToken: string };

export type IssueInput = {
  eventId: string;
  /** Our own User.id (the website has one) - or a Roblox id (the game has that). */
  holder: { userId: string } | { robloxId: string };
  /** null / "" = the implicit free General Admission. */
  tierId?: string | null;
  /**
   * Which org's events this caller may issue for. Same contract as
   * LookupInput.scope in verify.ts:
   *
   *   undefined   don't scope. The root key only.
   *   null        RNL's own shows.
   *   "<slug>"    that partner's, and nothing else.
   *
   * An event outside the scope answers "not_found" - never "not yours", which
   * would confirm the event exists to somebody with no business knowing.
   */
  scope?: string | null;
  mode: IssueMode;
};

const isCodeCollision = (err: any) =>
  err?.code === "P2002" && err?.meta?.target?.includes?.("code");

const isPurchaseReplay = (err: any) =>
  err?.code === "P2002" && err?.meta?.target?.includes?.("purchaseId");

const isDuplicateUser = (err: any) =>
  err?.code === "P2002" && err?.meta?.target?.includes?.("robloxId");

/**
 * Two tickets tried to take the same chair.
 *
 * The event row lock is what is supposed to make this impossible, and both of them
 * queued on it, so this firing at all means some future code path issued a ticket
 * WITHOUT taking the lock. @@unique([eventId, seatKey]) then catches what the lock was
 * meant to - which is precisely why the constraint exists as well as the lock, and not
 * instead of it.
 */
const isSeatCollision = (err: any) =>
  err?.code === "P2002" && err?.meta?.target?.includes?.("seatKey");

/**
 * Find, or create, the User row a ticket will hang off.
 *
 * The website always has one - you cannot reach the checkout without signing in.
 * The GAME does not: a player standing in a partner's experience may never have
 * opened ronation.live in their life, and refusing them a ticket on that basis
 * would be absurd. So their Roblox profile is resolved and a User row is created
 * for them, exactly as the OAuth callback would have.
 *
 * Resolved against Roblox rather than trusted from the request: the game sends an
 * id, and the username we store must be the one Roblox says goes with it, not one
 * the caller typed. Falls back to whatever we already hold if Roblox is having a
 * bad minute - a stale display name is not a reason to refuse somebody a ticket.
 *
 * The create RACES, and has to survive it. Two game servers greeting the same
 * first-time player at the same instant - or Roblox re-delivering one receipt while
 * the first is still in flight - both read "no such user" and both insert. One
 * wins; the other must pick up the winner's row rather than dying on the unique
 * constraint and handing a 500 to somebody who has already paid.
 */
async function resolveHolderUserId(
  holder: { userId: string } | { robloxId: string },
): Promise<string | null> {
  if ("userId" in holder) return holder.userId;

  const robloxId = String(holder.robloxId).trim();
  if (!/^\d{1,20}$/.test(robloxId)) return null;

  const existing = await prisma.user.findUnique({ where: { robloxId } });
  if (existing) return existing.id;

  const profile = await resolveRobloxUser(robloxId);
  if (!profile) return null; // Roblox has never heard of them.

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
  } catch (err) {
    // Lost the race. The row we were about to write now exists, written by
    // somebody else, and it is exactly the row we wanted. Take theirs.
    if (isDuplicateUser(err)) {
      const raced = await prisma.user.findUnique({ where: { robloxId } });
      if (raced) return raced.id;
    }
    throw err;
  }
}

/**
 * Have we already honoured this payment - and is the ticket it bought still alive?
 *
 * The second half of that question is new, and it is a BUG FIX with a real victim.
 *
 * This check used to hand back `settled.ticketId` without looking at it. On the
 * Developer Product rail that is very nearly safe: a purchaseId is a fresh GUID per
 * transaction, and ProcessReceipt re-delivers within minutes, so the ticket is still
 * warm.
 *
 * The GAME PASS rail breaks that assumption completely. Its idempotency key is
 * `gp:<passId>:<robloxId>` - see gamePassPurchaseId() - because a pass is owned
 * FOREVER and can therefore be honoured exactly once. Which means the very first thing
 * that happens when a holder cancels their ticket and comes back is: they hit this
 * branch, and get handed the CANCELLED ticket they just threw away. Every time. With no
 * way out, because the payment can never be re-made - Roblox will not sell them the
 * pass twice.
 *
 * So: re-read the ticket.
 *
 *   alive      hand it back. The ProcessReceipt retry, working as designed.
 *   revoked    refuse. They were thrown off this show BY NAME, and a payment does not
 *              buy that back - see the revoke note further down.
 *   cancelled  RESTORE it. They paid; they get a ticket. Fall through into the ordinary
 *              flow, which re-activates the row and re-allocates a seat - but remember
 *              NOT to write a second TicketPurchase against money that changed hands
 *              once.
 */
async function settleExisting(purchaseId: string): Promise<
  | { done: true; outcome: IssueOutcome; restore?: never }
  | { done: false; restore: boolean }
> {
  const settled = await prisma.ticketPurchase.findUnique({
    where: { purchaseId },
    select: { ticketId: true },
  });
  if (!settled) return { done: false, restore: false };

  const ticket = await prisma.ticket.findUnique({
    where: { id: settled.ticketId },
    select: { id: true, status: true, revokedAt: true },
  });

  if (ticket && ticket.status !== "CANCELLED") {
    return {
      done: true,
      outcome: { ok: true, ticketId: ticket.id, existing: true },
    };
  }

  if (ticket?.revokedAt) {
    return { done: true, outcome: fail("revoked") };
  }

  // Paid for, then cancelled - or the ticket row is gone entirely. Rebuild it, and do
  // not charge them again on the way.
  return { done: false, restore: true };
}

/**
 * Issue a ticket.
 *
 * Every refusal is a `reason`, never a throw - the callers are a form and a game
 * server, and neither of them can do anything useful with a stack trace. The one
 * exception is a code generator that cannot find a free code in five tries, which
 * is a broken generator and not a user error.
 */
export async function issueTicket(input: IssueInput): Promise<IssueOutcome> {
  const { eventId, mode } = input;

  // ---- A payment we have already honoured -------------------------------
  //
  // Checked FIRST, before anything else can refuse it. ProcessReceipt is
  // at-least-once: Roblox re-delivers a receipt until the game says it granted,
  // and a game server that crashed mid-call will send the same PurchaseId again.
  // By then the show may be sold out, or past, or the tier deactivated - and none
  // of that is a reason to tell somebody who has already been charged that they
  // have no ticket. They have one. Hand it back.
  //
  // `skipPurchaseRow` is what the settle check hands forward: a payment we have
  // ALREADY written a TicketPurchase row for must not get a second one when the
  // ticket it bought is rebuilt below.
  let skipPurchaseRow = false;

  if (mode.kind === "purchase") {
    const settled = await settleExisting(mode.purchaseId);
    if (settled.done) return settled.outcome;
    skipPurchaseRow = settled.restore;
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      partnerId: true,
      tiers: true,
      seatMode: true,
      venueMap: { select: { layout: true } },
    },
  });
  if (!event) return fail("not_found");

  // Scope. An event belonging to another org is "not_found", full stop - see the
  // note on IssueInput.scope.
  const partnerId = event.partnerId ?? null;
  if (input.scope !== undefined && partnerId !== input.scope) {
    return fail("not_found");
  }

  const partner = partnerBySlug(partnerId);
  const prefix = partner?.ticketPrefix ?? "RN";

  // The tier is resolved against THIS event's own tiers, so an id from another
  // show - or an invented one - matches nothing and never reaches the insert.
  const tiers = effectiveTiers(event.tiers);
  const tier = tiers.find((t) => (t.id ?? "") === (input.tierId ?? ""));
  if (!tier) return fail("badtier");

  // ---- The money wall ----------------------------------------------------
  const robuxAllowed = robuxSalesAllowed(partner, env.robuxTickets);

  if (tier.priceRobux > 0) {
    // A priced tier, and Robux sales are off - globally, or for this partner.
    // Nobody may have this tier today, by any route. Not even a gift: a comped
    // VIP seat to a tier that is not supposed to exist yet is still a VIP seat.
    if (!robuxAllowed) return fail("payments_off");

    // A priced tier reached by a path that collects nothing. The website's free
    // reserve lands here, and the answer is: this one is PAID for - on roblox.com
    // if it has a game pass, or inside the experience if it has a Developer
    // Product. Gifts pass, because a gift is a comp and charges nobody.
    if (mode.kind === "reserve") return fail("payment_required");

    if (mode.kind === "game_pass") {
      // The tier is not sold on this rail. Nobody drew it a pass, so a claim to have
      // bought its pass is a claim about a pass that does not exist.
      if (!tier.gamePassId) return fail("badtier");

      // The third key. Robux may be on and this partner may be allowed to price in
      // it, and the game-pass rail can STILL be off - because it needs the OAuth app
      // to carry the inventory scope, which neither of the other two switches can
      // see. See gamePassSalesAllowed().
      if (!gamePassSalesAllowed(partner, env.robuxTickets, env.robuxGamePass)) {
        return fail("payments_off");
      }
    }
  } else if (mode.kind === "purchase" || mode.kind === "game_pass") {
    // Free tier, and somebody says they paid for it. Something is wrong on the
    // caller's side - refuse rather than take the money and issue what they could
    // have had for nothing. The `|| game_pass` is the clause that stops the web
    // checkout charging for a free ticket.
    return fail("not_purchasable");
  }

  // ---- The hold ----------------------------------------------------------
  //
  // Read OUTSIDE the transaction, because the ownership check below needs to know who
  // the beneficiary is before it can ask Roblox about them - and that is a network
  // call, which must not happen under the lock. It is re-read INSIDE the transaction
  // before it is spent (see below); this read is advisory, and anything it decides is
  // re-decided under the lock.
  const intentToken =
    mode.kind === "game_pass"
      ? mode.intentToken
      : mode.kind === "purchase" || mode.kind === "reserve"
        ? (mode.intentToken ?? null)
        : null;

  let intent: PurchaseIntent | null = null;

  if (intentToken) {
    intent = await prisma.purchaseIntent.findUnique({
      where: { token: intentToken },
    });

    // Every one of these is "this hold is not the hold you say it is". They are all
    // `bad_intent` rather than four different words, because to the caller there is
    // exactly one thing to do about any of them, and to an attacker each distinct
    // answer is a free bit of information about somebody else's order.
    if (!intent) return fail("bad_intent");
    if (intent.eventId !== eventId) return fail("bad_intent");
    if ((intent.tierId ?? "") !== (tier.id ?? "")) return fail("bad_intent");
    if (intent.status === "CANCELLED") return fail("bad_intent");

    // NOTE what is NOT checked here: expiresAt.
    //
    // AN EXPIRED HOLD IS NOT A REFUSAL. They may well have paid - the charge happened
    // on a page we do not control, and the ten minutes ran out while they were on it.
    // What an expiry costs them is the SEAT THEY PICKED, not the ticket they paid for.
    // See the fallback under the lock.
  }

  // A game-pass claim with no hold has nothing to stand on: the hold is the only thing
  // that says which event, which tier and which person this pass was bought for.
  if (mode.kind === "game_pass" && !intent) return fail("bad_intent");

  // ---- Who is getting in -------------------------------------------------
  //
  // On an intent-backed issue the holder comes from the INTENT, not from the caller.
  // The caller named a token; the token names a person. That is what makes the token
  // safe to hand to Roblox and safe to put in a URL - it cannot be redirected onto
  // somebody else by whoever ends up holding it.
  const holder = intent ? { userId: intent.beneficiaryUserId } : input.holder;

  const userId = await resolveHolderUserId(holder);
  if (!userId) return fail("no_player");

  // A /purchase body that names a robloxId AND carries a token must agree with itself.
  // If it does not, something upstream is confused about whose ticket this is, and the
  // safe move is to stop rather than to pick one and hope.
  if (intent && "robloxId" in input.holder) {
    const named = await prisma.user.findUnique({
      where: { robloxId: String(input.holder.robloxId) },
      select: { id: true },
    });
    if (named?.id !== userId) return fail("bad_intent");
  }

  // ---- Did they ACTUALLY pay? --------------------------------------------
  //
  // The one question in this system that can be answered without believing anybody, and
  // this is where it gets asked.
  //
  // IT RUNS HERE, OUTSIDE THE TRANSACTION, and it must never be moved inside. The
  // transaction below holds a write lock on the event row, and every reserve, hold and
  // purchase for this show queues behind it. Those transactions are a handful of indexed
  // queries and clear in ~10ms - call it a hundred issues a second. An HTTP round trip
  // to Roblox is 200-800ms. Put this inside the lock and a sold-out show serialises to
  // THREE TICKETS A SECOND, on the one night of the year when that matters.
  //
  // It sits next to resolveHolderUserId(), which is a network call kept out here for
  // exactly the same reason.
  let gamePassKey: string | null = null;

  if (mode.kind === "game_pass") {
    const payerId = intent!.userId;

    const owns = await ownsGamePass(payerId, tier.gamePassId!);

    if (!owns.ok) {
      // Three-state, and the third state is the point. "We could not ask" is not "they
      // did not pay", and saying the second when we mean the first is how you tell
      // somebody who is 500 Robux down that they bought nothing.
      return fail(owns.reason === "no_grant" ? "needs_consent" : "verify_unavailable");
    }

    // Not an error. Roblox's inventory lags a purchase by seconds - this is the normal
    // answer while the buyer is still walking back to our tab. The checkout polls on it.
    if (!owns.owns) return fail("not_paid");

    // They own it. Now: has this pass already bought a ticket?
    //
    // `gp:<passId>:<robloxId>` rides the SAME unique constraint ProcessReceipt uses, so
    // the replay machinery, the double-claim guard and the payment ledger all come for
    // free - and a second claim on a pass somebody owns forever cannot mint a second
    // ticket. See gamePassPurchaseId().
    const payer = await prisma.user.findUnique({
      where: { id: payerId },
      select: { robloxId: true },
    });
    if (!payer) return fail("no_player");

    gamePassKey = gamePassPurchaseId(tier.gamePassId!, payer.robloxId);

    const settled = await settleExisting(gamePassKey);
    if (settled.done) return settled.outcome;
    skipPurchaseRow = settled.restore;
  }

  /** The idempotency key for whichever paying rail we are on. Null when nobody paid. */
  const purchaseKey =
    mode.kind === "purchase" ? mode.purchaseId : mode.kind === "game_pass" ? gamePassKey : null;

  // The event's own map. Parsed once, out here, rather than inside the retry loop.
  const layout = event.venueMap ? parseLayout(event.venueMap.layout) : null;

  // A seated show whose map does not parse. NOT "no map, so sell it as general
  // admission" - that would put the entire room on sale a second time, on top of
  // everybody already holding a seat in it. Refuse. See parseLayout().
  if (event.seatMode !== "NONE" && event.venueMap && !layout) {
    return fail("unavailable");
  }

  // What they hold is frozen at issue and never looked up again: renaming or
  // re-pricing the tier tomorrow must not rewrite the ticket they hold today.
  const held = {
    tierId: tier.id,
    tierName: tier.name,
    priceRobux: tier.priceRobux,
    termsAcceptedAt: new Date(),
    ...(mode.kind === "gift"
      ? { issuedByRobloxId: mode.byRobloxId, issuedByName: mode.byName }
      : {}),
  };

  // The code is minted outside the transaction, and a collision retries the whole
  // thing. It cannot be retried *inside*: in Postgres a failed statement aborts
  // the surrounding transaction, so the second attempt would die on the poisoned
  // transaction rather than on the duplicate code.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateTicketCode(prefix);
    try {
      return await prisma.$transaction(async (tx) => {
        // Take a write lock on the event row and hold it to commit. Everyone
        // reserving, HOLDING or paying for this event now queues here, so no two
        // requests can both read `capacity - 1` - or both read "A1-K12 is free" -
        // and both insert. It serialises per event, so other events are unaffected,
        // and unlike a Serializable transaction there is no retry loop to get wrong.
        //
        // Every count and every seat read below happens under it. THAT is what makes
        // a per-tier cap hold as tightly as the room's own, and a seat hold hold at all.
        const rows = await tx.$queryRaw<
          { id: string; capacity: number; status: string; startsAt: Date }[]
        >`SELECT id, capacity, status, "startsAt" FROM events WHERE id = ${eventId} FOR UPDATE`;

        const ev = rows[0];
        if (!ev || ev.status !== "PUBLISHED") return fail("unavailable");
        if (isPast(ev.startsAt)) return fail("past");

        const existing = await tx.ticket.findUnique({
          where: { eventId_userId: { eventId, userId } },
        });

        // ---- Revoked --------------------------------------------------
        //
        // The stamp survives cancellation precisely so it can be read here. This
        // person was thrown off this show by name, and handing them a fresh
        // ticket the moment they ask again would make the revoke a gesture.
        // Un-revoking is a deliberate act in the portal, not a side effect of
        // them clicking Reserve.
        if (existing?.revokedAt) return fail("revoked");

        // ---- The hold, re-read under the lock -------------------------
        //
        // A plain read, with no second FOR UPDATE on the intent row - because every
        // writer of a hold for this event takes the EVENT lock first (see
        // createPurchaseIntent), so by the time we are in here nobody else can be
        // touching it. One lock, held at one grain, is the whole concurrency story.
        const live = intent
          ? await tx.purchaseIntent.findUnique({ where: { id: intent.id } })
          : null;

        if (intent && !live) return fail("bad_intent");

        // Already spent. Two tabs, or a double-click on "check again". Hand back what
        // it made rather than erroring at somebody who has paid and is watching a
        // spinner - that is the whole difference between idempotent and merely correct.
        if (live?.status === "CONSUMED") {
          if (live.ticketId) {
            const made = await tx.ticket.findUnique({
              where: { id: live.ticketId },
              select: { id: true, status: true, userId: true },
            });
            if (made && made.userId === userId && made.status !== "CANCELLED") {
              return { ok: true as const, ticketId: made.id, existing: true };
            }
          }
          return fail("bad_intent");
        }

        // ---- The hold expired, and they paid anyway --------------------
        //
        // The case this whole design has to be honest about. They were charged - on
        // Roblox's website, on a page we do not control - and by the time they got back
        // here their ten minutes were up and their chair was gone.
        //
        // WE DO NOT REFUSE THEM. They have a ticket coming. What they lose is the SEAT
        // they picked, and only that: the wanted seat is dropped, and the allocator below
        // hands them the best available one in the same tier. If the tier is completely
        // full, THEN it fails - `seat_taken` - and that, and only that, is the case a
        // human has to refund.
        const expired = Boolean(live && live.expiresAt.getTime() < Date.now());
        const wantSeat = expired ? null : (live?.seatKey ?? null);
        const wantSection = expired ? null : (live?.sectionKey ?? null);

        // ---- The chair -------------------------------------------------
        //
        // Runs BEFORE the already-holds branch, because an upgrade needs one too: a GA
        // holder who buys VIP gets a VIP SEAT, not a VIP badge and a place in the pit.
        const seat = await resolveSeat({
          tx,
          eventId,
          seatMode: event.seatMode,
          layout,
          tier,
          wantSeat,
          wantSection,
          // Their own hold must not block them. Miss this and every buyer is refused the
          // one seat they are actually holding.
          ignoreIntentId: live?.id ?? null,
          // Nor may their own existing ticket. Same bug, wearing a hat: an upgrade that
          // collides with the GA chair the upgrader is already sitting in.
          ignoreTicketId: existing?.id ?? null,
        });
        if (!seat.ok) return fail(seat.reason);

        const seated: SeatAssignment = {
          seatKey: seat.seatKey,
          sectionKey: seat.sectionKey,
          seatLabel: seat.seatLabel,
        };

        /** Spend the hold. Called on every path that actually issues something. */
        const consume = async (ticketId: string) => {
          if (!live) return;
          await tx.purchaseIntent.update({
            where: { id: live.id },
            data: { status: "CONSUMED", consumedAt: new Date(), ticketId },
          });
        };

        /** Write the payment down - unless we already did, on a previous attempt. */
        const recordPayment = async (ticketId: string) => {
          if (!purchaseKey || skipPurchaseRow) return;
          await tx.ticketPurchase.create({
            data: {
              purchaseId: purchaseKey,
              ticketId,
              robuxSpent:
                mode.kind === "purchase" ? mode.robuxSpent : tier.priceRobux,
              apiKeyId: mode.kind === "purchase" ? (mode.apiKeyId ?? null) : null,
              placeId: mode.kind === "purchase" ? (mode.placeId ?? null) : null,
              productId: mode.kind === "purchase" ? (mode.productId ?? null) : null,
            },
          });
        };

        // ---- They already hold one ------------------------------------
        if (existing && existing.status !== "CANCELLED") {
          // A payment is not a no-op. They have been CHARGED. Silently handing back the
          // ticket they already had would be taking Robux for nothing - so the payment
          // lands on the ticket they hold, upgrading its tier AND its chair. It is the
          // same ticket (one per person per event, always), now VIP, now sitting down.
          if (mode.kind === "purchase" || mode.kind === "game_pass") {
            await tx.ticket.update({
              where: { id: existing.id },
              data: {
                tierId: tier.id,
                tierName: tier.name,
                priceRobux: tier.priceRobux,
                ...seated,
              },
            });
            await recordPayment(existing.id);
            await consume(existing.id);
            return { ok: true as const, ticketId: existing.id, existing: true };
          }

          // Reserve and gift are idempotent instead: you cannot hold two tickets
          // to one show, and asking twice is not an error. Under the lock, so a
          // double-submit resolves to the same ticket rather than a unique-
          // constraint explosion.
          return { ok: true as const, ticketId: existing.id, existing: true };
        }

        // The room's cap (0 = unlimited).
        if (ev.capacity > 0) {
          const taken = await tx.ticket.count({
            where: { eventId, status: { not: "CANCELLED" } },
          });
          if (taken >= ev.capacity) return fail("soldout");
        }

        // The tier's own cap, on top. The implicit tier has no id and no cap.
        if (tier.id && tier.capacity > 0) {
          const takenInTier = await tx.ticket.count({
            where: { eventId, tierId: tier.id, status: { not: "CANCELLED" } },
          });
          if (takenInTier >= tier.capacity) return fail("tier_soldout");
        }

        // Re-activate a cancelled ticket, or create a fresh one. Re-reserving
        // re-picks the tier, so the frozen snapshot is rewritten with it.
        const ticketId = existing
          ? (
              await tx.ticket.update({
                where: { id: existing.id },
                data: { status: "RESERVED", ...held, ...seated },
              })
            ).id
          : (
              await tx.ticket.create({
                data: {
                  eventId,
                  userId,
                  code,
                  status: "RESERVED",
                  ...held,
                  ...seated,
                },
              })
            ).id;

        await recordPayment(ticketId);
        await consume(ticketId);

        return { ok: true as const, ticketId, existing: false };
      });
    } catch (err) {
      // Two calls with the same PurchaseId, racing. One committed; this one lost
      // on the unique constraint, which is the constraint doing its job. Re-read
      // and hand back the ticket the winner created.
      if (isPurchaseReplay(err) && purchaseKey) {
        const settled = await prisma.ticketPurchase.findUnique({
          where: { purchaseId: purchaseKey },
          select: { ticketId: true },
        });
        if (settled) {
          return { ok: true, ticketId: settled.ticketId, existing: true };
        }
      }

      // Two people took the same chair.
      //
      // This SHOULD be impossible - the event row lock is what stops it, and both of them
      // queued on it. So reaching here means the lock was bypassed by some future code
      // path that forgot to take it, and @@unique([eventId, seatKey]) has just caught what
      // the lock was supposed to.
      //
      // Which is exactly what a backstop is for. Retry: the loop re-enters the lock,
      // resolveSeat sees the seat is now taken, and falls back to the next one. The bug
      // costs a round trip instead of a double-sold chair.
      if (isSeatCollision(err)) continue;

      if (isCodeCollision(err)) continue;
      throw err;
    }
  }

  // Five collisions in a 31^6 space is not bad luck, it is a broken generator.
  // Throw rather than hand back a code no ticket was ever issued under.
  throw new Error("Could not allocate a unique ticket code after 5 attempts");
}

// ---- Taking a ticket away --------------------------------------------------

export type VoidOutcome =
  | { ok: true; ticketId: string; banned: boolean; alreadyVoid: boolean }
  | { ok: false; reason: "not_found" | "checked_in" };

/**
 * Void a ticket, or revoke it.
 *
 * They are the same write plus one column, and the difference is entirely in what
 * happens NEXT - which is why they are one function and not two:
 *
 *   void    (ban: false)  Cancel it. The undo. Issued to the wrong player, a
 *                         duplicate, a change of plan. They may reserve again
 *                         immediately, exactly as if they had cancelled it
 *                         themselves.
 *
 *   revoke  (ban: true)   Cancel it AND stamp revokedAt, which issueTicket()
 *                         reads and refuses over. The problem is the person, not
 *                         the ticket. It bans them from THIS SHOW - a standing
 *                         ban across every show is the blacklist, which is a
 *                         different question with a different answer.
 *
 * A CHECKED_IN ticket is refused. They are already inside the room; cancelling
 * the ticket does not get them out of it, and it would leave the door's own
 * record saying somebody who never came in did. Whoever is asking for this wants
 * security, not a database write.
 */
export async function voidTicket(input: {
  ticketId: string;
  ban: boolean;
  reason?: string | null;
  actorName: string;
}): Promise<VoidOutcome> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: input.ticketId },
    select: { id: true, status: true, revokedAt: true },
  });
  if (!ticket) return { ok: false, reason: "not_found" };
  if (ticket.status === "CHECKED_IN") return { ok: false, reason: "checked_in" };

  const alreadyVoid = ticket.status === "CANCELLED";

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      status: "CANCELLED",

      // ---- GIVE THE CHAIR BACK ------------------------------------------
      //
      // This is not tidying up. It is the ONLY thing that frees a seat, and leaving it
      // out silently breaks the show.
      //
      // @@unique([eventId, seatKey]) binds CANCELLED rows too - Postgres cannot express
      // "unique among live tickets" without a partial index, and `prisma db push` runs on
      // every boot and drops those (see the note on Ticket.seatKey). So a cancelled row
      // that still carries a seatKey still OWNS that seat, forever: nobody can be sold it,
      // the map renders it taken, and there is nobody sitting in it.
      //
      // `seatLabel` is deliberately NOT cleared. It is frozen, like tierName - the stub
      // still says where they would have been sitting. What they lose is the chair, not
      // the memory of it.
      //
      // The mirror of this line lives in cancelTicket() in app/actions/tickets.ts. There
      // are exactly two writers, and they must both do this.
      seatKey: null,
      sectionKey: null,

      // Revoking an already-voided ticket upgrades it to a ban, which is a real
      // thing somebody will want to do. Voiding an already-REVOKED one does NOT
      // silently lift the ban - clearing it is its own deliberate act.
      ...(input.ban
        ? {
            revokedAt: ticket.revokedAt ?? new Date(),
            revokedReason: input.reason?.trim() || null,
            revokedByName: input.actorName,
          }
        : {}),
    },
  });

  return {
    ok: true,
    ticketId: ticket.id,
    banned: input.ban || Boolean(ticket.revokedAt),
    alreadyVoid,
  };
}

/**
 * Lift a revocation. The holder may reserve again; the ticket stays cancelled.
 *
 * ---- The scope is not optional -------------------------------------------
 *
 * This used to match on `{ id }` alone, with no scope check anywhere in it, which meant
 * every caller owned the scoping - and the only caller was nobody, because for the whole
 * life of this function NOTHING CALLED IT. It was exported, documented, and dead, while
 * api/v1/tickets/revoke told the world that "lifting it is a deliberate act in the portal".
 * That act did not exist: a show-banned attendee could not be un-banned by anyone, through
 * any surface.
 *
 * Now that there IS a caller, the scope is a required argument rather than a rule the
 * caller has to remember. `null` is RNL's own shows; a slug is a partner's. A ticket
 * belonging to another org matches zero rows and the ban simply does not lift - which is
 * the right failure, and it is a failure the function cannot be talked out of.
 */
export async function unrevokeTicket(ticketId: string, scope: string | null) {
  await prisma.ticket.updateMany({
    // The scope travels through the EVENT, because that is where a ticket's org actually
    // lives - a Ticket row has no partnerId of its own.
    where: { id: ticketId, event: { partnerId: scope } },
    data: { revokedAt: null, revokedReason: null, revokedByName: null },
  });
}

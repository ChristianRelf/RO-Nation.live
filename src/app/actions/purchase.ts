"use server";

import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/session";
import {
  createPurchaseIntent,
  findIntent,
  releaseIntent,
  type IntentReason,
} from "@/lib/tickets/intents";
import { issueTicket } from "@/lib/tickets/issue";
import { gamePassUrl } from "@/lib/roblox-gamepass";

// The seat picker's half of the hold.
//
// Two actions, and neither of them decides anything. createPurchaseIntent() in
// lib/tickets/intents.ts takes the event row lock, counts the room, calls the ONE allocator
// and writes the hold; this file adds the session and hands the outcome back. Same division
// of labour as actions/tickets.ts, and for the same reason: a game booth holds seats through
// the same library, and two copies of "is that chair free?" eventually disagree.
//
// ---- Nothing here redirects, and nothing here can ---------------------------
//
// A redirect() from a SERVER ACTION does not run the middleware, and the middleware is the
// only thing that knows <slug>.ronation.live/events/x means /p/<slug>/events/x. So these
// RETURN their outcome and the client navigates - the long version of that story is at the
// top of actions/tickets.ts.
//
// ---- The seat is not trusted, and does not need to be -----------------------
//
// `seat` and `section` come off a form, which means they come off a person. They are HINTS.
// resolveSeat() proves the seat exists, that it belongs to THIS tier, and that nobody else
// has it - under the lock - and quietly gives them the best available one if any of that
// fails. So a hand-typed seatKey cannot buy a VIP chair at a GA price; the worst it can do
// is ask for a chair that isn't there and be given a real one instead.

export type HoldState =
  | {
      ok: true;
      token: string;
      /** ISO. A Date is awkward across the boundary, and the countdown wants a string. */
      expiresAt: string;
      seatKey: string | null;
      sectionKey: string | null;
      /** "Balcony Left · Row K · Seat 12". What the bar shows and the stub will say. */
      seatLabel: string | null;
    }
  | { ok: false; error: IntentReason | "auth" };

/** useFormState's signature, the same one reserveTicket uses. */
export async function createIntent(
  _prev: HoldState | null,
  formData: FormData,
): Promise<HoldState> {
  const eventId = String(formData.get("eventId") || "");
  const tierId = String(formData.get("tierId") || ""); // "" = the implicit tier
  const seatKey = String(formData.get("seat") || "");
  const sectionKey = String(formData.get("section") || "");

  const session = await getUserSession();
  if (!session) return { ok: false, error: "auth" };

  const outcome = await createPurchaseIntent({
    eventId,
    payer: { userId: session.uid },
    tierId,
    // Empty is not "no preference" by accident - it IS no preference, and resolveSeat reads
    // null as "give them the best available". That is exactly what the Best available button
    // sends, so the button and the fallback are the same code path.
    seatKey: seatKey || null,
    sectionKey: sectionKey || null,
    // No rail: this is the FREE hold the seat picker takes. A priced tier reaching here
    // comes back `bad_rail` rather than holding a seat for a sale that cannot happen - the
    // paid path is startGamePass() below, which is the only thing in the web application
    // that ever names a rail.
    rail: null,
    // Unscoped, like reserveTicket: this is a buyer holding a seat on a show they are
    // standing in front of. Scope is what stops a partner's API KEY reaching RNL's shows.
  });

  if (!outcome.ok) return { ok: false, error: outcome.reason };

  return {
    ok: true,
    token: outcome.token,
    expiresAt: outcome.expiresAt.toISOString(),
    seatKey: outcome.seatKey,
    sectionKey: outcome.sectionKey,
    seatLabel: outcome.seatLabel,
  };
}

/**
 * Give the seat back.
 *
 * They changed their mind, or closed the tab. Nothing breaks if this is never called - the
 * hold dies on its own in ten minutes - but calling it means the next person sees the chair
 * now instead of staring at a seat nobody wants.
 *
 * releaseIntent() is scoped to the OWNER of the hold, so a token that leaks into a log
 * cannot be used to release somebody else's seat out from under them.
 */
export async function releaseHold(formData: FormData) {
  const token = String(formData.get("token") || "");
  const session = await getUserSession();
  if (!session || !token) return;

  await releaseIntent(token, session.uid);
}

// ---- The game-pass rail ----------------------------------------------------

export type StartPassState =
  | {
      ok: true;
      token: string;
      expiresAt: string;
      /** Read off the TIER, server-side, under the lock. Never off the client. */
      gamePassId: string;
      /**
       * The pass page on roblox.com - built HERE, and handed to the client ready-made.
       *
       * gamePassUrl() lives in lib/roblox-gamepass.ts, which is `server-only`, so the
       * checkout component physically cannot import it. The alternative - hardcoding
       * `roblox.com/game-pass/${id}` into the component - would be a second copy of the one
       * fact this rail sends every buyer to, and the day Roblox changes that path only one
       * of the two copies would be found.
       */
      gamePassUrl: string;
      priceRobux: number;
      seatLabel: string | null;
    }
  | { ok: false; error: IntentReason | "auth" };

/**
 * Put a hold on the GAME_PASS rail, and tell the buyer which pass to go and buy.
 *
 * The one place in the web application that names a rail. Everything about it is read from
 * the database under the event row lock - the pass id comes off the live tier row, not off
 * the form - because a caller who could NAME the pass could name a pass they already own,
 * and walk out with a free VIP ticket with our own ownership check waving them through.
 * issue.ts makes exactly this point about its `game_pass` mode carrying a token and nothing
 * else; this is the other end of that rule.
 *
 * ---- Why it takes the buyer's EXISTING hold -------------------------------
 *
 * On a seated show they have been holding a chair since they clicked it on the map, and that
 * hold has `rail: null` because it was taken before anybody mentioned money. Switching rails
 * means a new intent - so the seat has to survive the switch, and it must NOT be re-sent by
 * the client (a seat off a form is a seat somebody can edit).
 *
 * So the old token is passed in, PROVED to be theirs, and the seat is read off it here. Then
 * createPurchaseIntent cancels their old hold and takes the new one in the same transaction,
 * under the same lock - which means the chair is never, at any instant, released back into
 * the room. Its "one live hold per person" rule was written for exactly this.
 */
export async function startGamePass(
  _prev: StartPassState | null,
  formData: FormData,
): Promise<StartPassState> {
  const eventId = String(formData.get("eventId") || "");
  const tierId = String(formData.get("tierId") || "");
  const previous = String(formData.get("intent") || "");

  const session = await getUserSession();
  if (!session) return { ok: false, error: "auth" };

  // Their seat, off their OWN hold. A token that is not theirs, or not this event's, tells
  // us nothing and is ignored - they simply get the best available chair instead, which is
  // the same thing that happens to anybody whose hold expired.
  let seatKey: string | null = null;
  let sectionKey: string | null = null;

  if (previous) {
    const held = await findIntent(previous);
    if (held && held.eventId === eventId && held.userId === session.uid) {
      seatKey = held.seatKey;
      sectionKey = held.sectionKey;
    }
  }

  const outcome = await createPurchaseIntent({
    eventId,
    payer: { userId: session.uid },
    tierId,
    seatKey,
    sectionKey,
    rail: "GAME_PASS",
  });

  if (!outcome.ok) return { ok: false, error: outcome.reason };

  // createPurchaseIntent only returns a gamePassId on the GAME_PASS rail, and it reads it
  // off the tier. If it is missing, the tier lost its pass between the page rendering and
  // this call - which is `bad_rail`, and is exactly what it would have refused a moment
  // later anyway.
  if (!outcome.gamePassId) return { ok: false, error: "bad_rail" };

  return {
    ok: true,
    token: outcome.token,
    expiresAt: outcome.expiresAt.toISOString(),
    gamePassId: outcome.gamePassId,
    gamePassUrl: gamePassUrl(outcome.gamePassId),
    priceRobux: outcome.priceRobux,
    seatLabel: outcome.seatLabel,
  };
}

export type ClaimState =
  | { ok: true; ticketId: string }
  | {
      ok: false;
      error:
        | "auth"
        | "bad_intent"
        /**
         * ROBLOX HAS NOT SEEN THE PURCHASE YET. **This is not a failure.**
         *
         * Their inventory lags a purchase by seconds, so this is the ordinary answer for
         * the entire time a buyer is walking back to our tab. The checkout renders it as
         * "waiting for Roblox" and keeps polling. It must NEVER render it as "payment
         * failed": the one thing worse than a slow checkout is telling somebody who is 500
         * Robux down that they did not pay.
         */
        | "waiting"
        /** They never granted the inventory scope, or revoked it. The fix is a BUTTON. */
        | "needs_consent"
        /** We could not ask Roblox. The fix is WAITING. Take nothing, promise nothing. */
        | "unavailable"
        | "seat_taken"
        | "soldout"
        | "tier_soldout"
        | "revoked"
        | "past";
    };

/**
 * How often we are allowed to ASK ROBLOX. The checkout polls us every 2s.
 *
 * The gap is deliberate and the guard lives in the DATABASE (`PurchaseIntent.checkedAt`),
 * not in a ref on the client: a buyer who hits refresh, or opens the order in a second tab,
 * would otherwise reset a client-side limiter to zero and hammer the one Roblox endpoint
 * this rail cannot afford to be rate-limited on.
 */
const ROBLOX_POLL_MS = 4000;

/**
 * "Have they paid yet?"
 *
 * Called on a loop by the checkout. Almost every call answers `waiting` and must be cheap:
 * the common path is one indexed read and NO network at all, because the rate limit below
 * short-circuits before ownsGamePass() is ever reached.
 */
export async function claimGamePass(
  _prev: ClaimState | null,
  formData: FormData,
): Promise<ClaimState> {
  const token = String(formData.get("token") || "");

  const session = await getUserSession();
  if (!session) return { ok: false, error: "auth" };
  if (!token) return { ok: false, error: "bad_intent" };

  const intent = await findIntent(token);
  if (!intent) return { ok: false, error: "bad_intent" };
  if (intent.userId !== session.uid) return { ok: false, error: "bad_intent" };
  if (intent.rail !== "GAME_PASS") return { ok: false, error: "bad_intent" };
  // CONSUMED means it already became a ticket - which is not a failure, and is what a
  // double-click or a second tab hits. Send them to it.
  if (intent.status === "CONSUMED" && intent.ticketId) {
    return { ok: true, ticketId: intent.ticketId };
  }
  if (intent.status === "CANCELLED") return { ok: false, error: "bad_intent" };

  // ---- The rate limit, as a compare-and-swap ------------------------------
  //
  // `checkedAt: { lt: cutoff }` in the WHERE clause is what makes this safe against the two
  // tabs and the refresh: whoever wins the update does the Roblox call, and everybody else
  // matches zero rows and is told to wait. A read-then-write would have a window between
  // them wide enough for both tabs to walk through.
  const cutoff = new Date(Date.now() - ROBLOX_POLL_MS);

  const { count } = await prisma.purchaseIntent.updateMany({
    where: {
      token,
      OR: [{ checkedAt: null }, { checkedAt: { lt: cutoff } }],
    },
    data: { checkedAt: new Date() },
  });

  if (count === 0) return { ok: false, error: "waiting" };

  // The claim. It carries A TOKEN AND NOTHING ELSE - not the pass id, not the price, not the
  // seat, not the buyer. issueTicket re-reads every one of those from the database, asks
  // Roblox whether this person owns the pass (outside the transaction, deliberately - see
  // the long note in issue.ts about the lock), and writes the payment row keyed on
  // `gp:<passId>:<robloxId>` so a replay cannot mint a second ticket.
  const outcome = await issueTicket({
    eventId: intent.eventId,
    // Ignored on this rail - the holder comes from the INTENT, which is what makes the
    // token safe to have been sitting in a URL on roblox.com. Passed because the type
    // wants a holder.
    holder: { userId: session.uid },
    tierId: intent.tierId ?? "",
    mode: { kind: "game_pass", intentToken: token },
  });

  if (outcome.ok) return { ok: true, ticketId: outcome.ticketId };

  switch (outcome.reason) {
    // The three that are NOT errors, and the whole reason ownsGamePass() is three-state.
    case "not_paid":
      return { ok: false, error: "waiting" };
    case "needs_consent":
      return { ok: false, error: "needs_consent" };
    case "verify_unavailable":
      return { ok: false, error: "unavailable" };

    case "seat_taken":
      return { ok: false, error: "seat_taken" };
    case "soldout":
      return { ok: false, error: "soldout" };
    case "tier_soldout":
      return { ok: false, error: "tier_soldout" };
    case "revoked":
      return { ok: false, error: "revoked" };
    case "past":
      return { ok: false, error: "past" };
    default:
      return { ok: false, error: "bad_intent" };
  }
}

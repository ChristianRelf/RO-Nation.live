import { NextRequest, NextResponse } from "next/server";
import {
  authorize,
  badRequest,
  readJson,
  resolveEventId,
  str,
} from "@/lib/api/guard";
import { createPurchaseIntent } from "@/lib/tickets/intents";
import { INTENT_MESSAGES } from "@/lib/api/messages";

export const dynamic = "force-dynamic";

// POST /api/v1/intents - HOLD a seat while a player decides.
//
// Auth:  x-api-key: <key>        scope: INTENTS_WRITE
// Body:  { robloxId, eventId, tierId?, seatKey?, sectionKey? }
//
// THE MISSING PRIMITIVE. Without it a walk-up booth cannot exist, and the reason is not
// subtle: between "I'll have row K seat 12" and the player's ProcessReceipt firing, there is
// a Roblox purchase prompt - seconds at best, a minute if they go and check their balance.
// With no hold, a second booth in a second server shows that chair as free the whole time,
// sells it, and exactly one of the two people who paid Robux gets it. The other has to be
// refunded by hand, by a human, who first has to work out that it happened at all.
//
// ---- The scope is INTENTS_WRITE, and that is the point ---------------------
//
// NOT TICKETS_PURCHASE. That scope's entire warning is that it can assert a payment nothing
// on our side can check; holding a chair cannot take a penny off anybody. A lobby board
// should be able to hold seats without also being able to mint itself a free VIP ticket.
//
// ---- What you get back -----------------------------------------------------
//
//   token         Hand this to PromptProductPurchase's flow and send it back to
//                 /tickets/purchase as `intentToken`. It is also what goes in `launchData`
//                 on a deep link, so a buy that started on the web can finish in-game.
//   expiresAt     Ten minutes. After it, the hold stops counting - but an expired hold is
//                 NOT a refusal at purchase time: the player keeps their ticket and loses
//                 only the chair they picked. See /tickets/purchase.
//   seatKey       THE CHAIR THEY ACTUALLY GOT, which is not always the one you asked for.
//                 If it was taken half a second ago they are moved to the next best seat in
//                 the same tier, silently and deliberately. Render what comes back, never
//                 what you sent.
//   devProductId  What to prompt. Read off the tier, here, so the game never has to hold a
//                 mapping of tier -> product that can drift out of date.

export async function POST(req: NextRequest) {
  const auth = await authorize(req, "INTENTS_WRITE");
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(req);
  const robloxId = str(body.robloxId);

  if (!robloxId || !str(body.eventId)) {
    return badRequest("provide `robloxId` and `eventId`");
  }

  // An id OR a slug, like every read endpoint - see resolveEventId(). A booth that reads the
  // seat map by slug and then cannot hold a seat by slug is a booth that works right up
  // until somebody tries to buy something.
  const eventId = await resolveEventId(str(body.eventId));
  if (!eventId) {
    return NextResponse.json({
      ok: true,
      held: false,
      reason: "not_found",
      message: INTENT_MESSAGES.not_found,
      intent: null,
    });
  }

  const outcome = await createPurchaseIntent({
    eventId,
    // The player standing at the booth. They may never have opened ronation.live in their
    // life - createPurchaseIntent greets them and makes the User row, exactly as /reserve
    // does.
    payer: { robloxId },
    tierId: str(body.tierId),
    seatKey: str(body.seatKey),
    sectionKey: str(body.sectionKey),
    // In-experience means a Developer Product. A game pass cannot be prompted from a game
    // server, and it is also the rail that cannot be gifted - so it is not on offer here.
    // The rail is only set for a PRICED tier; a free seated ticket still needs a hold, and
    // its rail is null, which is the honest answer (there is nothing to pay).
    rail: "DEV_PRODUCT",
    // The org this key belongs to. There is no way for the request to widen it.
    scope: auth.caller.scope,
  });

  if (!outcome.ok) {
    return NextResponse.json({
      ok: true,
      held: false,
      reason: outcome.reason,
      message: INTENT_MESSAGES[outcome.reason],
      intent: null,
    });
  }

  return NextResponse.json({
    ok: true,
    held: true,
    intent: {
      token: outcome.token,
      expiresAt: outcome.expiresAt,
      priceRobux: outcome.priceRobux,
      // Null on a free tier - and a free seated ticket is a perfectly ordinary thing to
      // hold. Nothing to prompt: call /tickets/reserve with the token instead.
      devProductId: outcome.devProductId,
      // What they GOT. Not what you asked for. See above.
      seatKey: outcome.seatKey,
      sectionKey: outcome.sectionKey,
      /** "Balcony Left · Row K · Seat 12". Print this; don't build your own. */
      seatLabel: outcome.seatLabel,
    },
  });
}

// A free tier on this rail is not an error - it just has nothing to prompt. The reason codes
// below are the ones a booth can actually hit; the rest are impossible from here (a game
// server cannot ask for a game pass, so `cannot_gift` and the pass-only refusals cannot
// arise).

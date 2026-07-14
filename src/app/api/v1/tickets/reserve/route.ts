import { NextRequest, NextResponse } from "next/server";
import {
  authorize,
  badRequest,
  readJson,
  resolveEventId,
  str,
} from "@/lib/api/guard";
import { ticketEnvelope } from "@/lib/api/lookup";
import { issueTicket } from "@/lib/tickets/issue";
import { ISSUE_MESSAGES } from "@/lib/api/messages";

export const dynamic = "force-dynamic";

// POST /api/v1/tickets/reserve - hand a player a ticket, from inside the game.
//
// Auth:  x-api-key: <key>          scope: TICKETS_ISSUE
// Body:  { robloxId, eventId, tierId? }
//
// The player is standing in front of you and wants in. They do not have to open a
// website first: they have a Roblox account, and that is enough. If they have
// never signed in to ronation.live in their life, a User row is created for them
// here, from their Roblox profile - see resolveHolderUserId().
//
// FREE TIERS ONLY. A priced tier comes back `payment_required`, because a ticket
// somebody has to pay for is bought through /purchase, from a ProcessReceipt
// handler, after Roblox has actually taken the Robux. Reserving one here would be
// giving the room away.
//
// Idempotent: a player who already holds a ticket for this show gets the ticket
// they already hold, with `created: false`. Nobody holds two.
//
// ---- `intentToken` is OPTIONAL here, even on a seated show -----------------
//
// Pass one and the player gets THE SEAT THEY PICKED off your booth's map. Leave it out and
// they get the best available seat in the tier, chosen by the same allocator - which is a
// perfectly good ticket, and is why this is optional where /purchase's is not.
//
// The asymmetry is money. On /purchase, guessing a seat means somebody has already paid for
// a chair nobody agreed on; here, the worst case is a free ticket in a seat they did not
// choose. So a booth that offers a map should send the token, and one that just hands out
// free tickets does not have to think about seating at all.
//
// Responds in the same shape as /verify, plus `created`. See ticketEnvelope().

export async function POST(req: NextRequest) {
  const auth = await authorize(req, "TICKETS_ISSUE");
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(req);
  const robloxId = str(body.robloxId);

  // No username fallback, and that is deliberate: this WRITES. A username is a
  // label a player can change, and resolving one costs a round trip to Roblox that
  // can fail - neither is a thing to hang "who gets a ticket" on. The game server
  // has Player.UserId. Use it.
  if (!robloxId || !str(body.eventId)) {
    return badRequest("provide `robloxId` and `eventId`");
  }

  // An id OR a slug - see resolveEventId(). One event identifier, one constant in the game,
  // accepted by every endpoint it is handed to.
  const eventId = await resolveEventId(str(body.eventId));
  if (!eventId) {
    return NextResponse.json({
      ok: true,
      issued: false,
      reason: "not_found",
      message: ISSUE_MESSAGES.not_found,
      ticket: null,
      event: null,
      holder: null,
    });
  }

  const outcome = await issueTicket({
    eventId,
    holder: { robloxId },
    tierId: str(body.tierId),
    scope: auth.caller.scope,
    // The hold, if the booth took one. Carried, never trusted: issueTicket re-reads it under
    // the row lock and refuses it if it is not this event's, this tier's and this person's.
    mode: { kind: "reserve", intentToken: str(body.intentToken) },
  });

  if (!outcome.ok) {
    return NextResponse.json(
      {
        ok: true,
        issued: false,
        reason: outcome.reason,
        message: ISSUE_MESSAGES[outcome.reason],
        ticket: null,
        event: null,
        holder: null,
      },
      // A refusal is not an HTTP error - the request was understood perfectly, and
      // the answer is no. Same rule as /verify: 200 with a reason, so a Luau
      // integration branches on the body rather than on the status code.
      { status: 200 },
    );
  }

  return ticketEnvelope(outcome.ticketId, auth.caller, {
    issued: true,
    created: !outcome.existing,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { authorize, badRequest, readJson, str } from "@/lib/api/guard";
import { ticketEnvelope } from "@/lib/api/lookup";
import { issueTicket } from "@/lib/tickets/issue";
import { ISSUE_MESSAGES } from "@/lib/api/messages";

export const dynamic = "force-dynamic";

// POST /api/v1/tickets/reserve — hand a player a ticket, from inside the game.
//
// Auth:  x-api-key: <key>          scope: TICKETS_ISSUE
// Body:  { robloxId, eventId, tierId? }
//
// The player is standing in front of you and wants in. They do not have to open a
// website first: they have a Roblox account, and that is enough. If they have
// never signed in to ronation.live in their life, a User row is created for them
// here, from their Roblox profile — see resolveHolderUserId().
//
// FREE TIERS ONLY. A priced tier comes back `payment_required`, because a ticket
// somebody has to pay for is bought through /purchase, from a ProcessReceipt
// handler, after Roblox has actually taken the Robux. Reserving one here would be
// giving the room away.
//
// Idempotent: a player who already holds a ticket for this show gets the ticket
// they already hold, with `created: false`. Nobody holds two.
//
// Responds in the same shape as /verify, plus `created`. See ticketEnvelope().

export async function POST(req: NextRequest) {
  const auth = await authorize(req, "TICKETS_ISSUE");
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(req);
  const robloxId = str(body.robloxId);
  const eventId = str(body.eventId);

  // No username fallback, and that is deliberate: this WRITES. A username is a
  // label a player can change, and resolving one costs a round trip to Roblox that
  // can fail — neither is a thing to hang "who gets a ticket" on. The game server
  // has Player.UserId. Use it.
  if (!robloxId || !eventId) {
    return badRequest("provide `robloxId` and `eventId`");
  }

  const outcome = await issueTicket({
    eventId,
    holder: { robloxId },
    tierId: str(body.tierId),
    scope: auth.caller.scope,
    mode: { kind: "reserve" },
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
      // A refusal is not an HTTP error — the request was understood perfectly, and
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

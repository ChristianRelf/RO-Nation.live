import { NextRequest, NextResponse } from "next/server";
import { authorize, badRequest, readJson, str } from "@/lib/api/guard";
import { ticketEnvelope } from "@/lib/api/lookup";
import { ISSUE_MESSAGES } from "@/lib/api/messages";
import { issueTicket } from "@/lib/tickets/issue";
import { resolveRobloxUser } from "@/lib/roblox-users";

export const dynamic = "force-dynamic";

// POST /api/v1/tickets/gift - somebody gives somebody else a ticket.
//
// Auth:  x-api-key: <key>          scope: TICKETS_ISSUE
// Body:  { robloxId, eventId, fromRobloxId, tierId?, fromName? }
//
//   robloxId      who GETS the ticket
//   fromRobloxId  who GAVE it - a giveaway bot's owner, a crew member, a player
//                 buying one for a friend
//
// It is /reserve with a name attached, and the name is the whole point: a VIP seat
// that nobody paid for and nobody is recorded as having handed out is a VIP seat
// that turns up in an audit as a mystery. `issuedBy…` is stamped on the ticket and
// shown in the portal.
//
// A gift MAY be a priced tier. That is a COMP - a free VIP, given away - and no
// Robux changes hands, which is exactly what a giveaway is. It still respects the
// paid-ticket kill switch: if Robux sales are off for this org, its priced tiers
// do not exist yet, and comping a seat in a tier that isn't supposed to exist is
// still handing out a seat.
//
// The recipient does NOT need an account on ronation.live. See /reserve.

export async function POST(req: NextRequest) {
  const auth = await authorize(req, "TICKETS_ISSUE");
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(req);
  const robloxId = str(body.robloxId);
  const eventId = str(body.eventId);
  const fromRobloxId = str(body.fromRobloxId);

  if (!robloxId || !eventId || !fromRobloxId) {
    return badRequest("provide `robloxId`, `eventId` and `fromRobloxId`");
  }

  // Who to credit the gift to. `fromName` is a courtesy for a giver who is not a
  // Roblox player at all ("STRO Giveaway Bot") - otherwise the name is resolved
  // from Roblox rather than taken from the body, so a giver cannot sign somebody
  // else's name to a ticket they handed out.
  const giver = await resolveRobloxUser(fromRobloxId);
  const byName = giver?.username ?? str(body.fromName) ?? `Roblox #${fromRobloxId}`;

  const outcome = await issueTicket({
    eventId,
    holder: { robloxId },
    tierId: str(body.tierId),
    scope: auth.caller.scope,
    mode: { kind: "gift", byRobloxId: fromRobloxId, byName },
  });

  if (!outcome.ok) {
    return NextResponse.json({
      ok: true,
      issued: false,
      reason: outcome.reason,
      message: ISSUE_MESSAGES[outcome.reason],
      ticket: null,
      event: null,
      holder: null,
    });
  }

  return ticketEnvelope(outcome.ticketId, auth.caller, {
    issued: true,
    created: !outcome.existing,
    // false when they already held one. The giver should be told their gift
    // landed on a ticket the recipient already had - not that it vanished.
    gifted: !outcome.existing,
  });
}

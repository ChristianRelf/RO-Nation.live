import { NextRequest, NextResponse } from "next/server";
import { authorize, badRequest, readJson } from "@/lib/api/guard";
import { IDENTIFY_ERROR, lookupFrom } from "@/lib/api/lookup";
import { BAD_REQUEST, checkTicket } from "@/lib/tickets/verify";

export const dynamic = "force-dynamic";

// POST /api/v1/tickets/verify - is this ticket good, and what is it?
//
// Auth:  x-api-key: <key>          scope: TICKETS_VERIFY
// Body:  { code }, or { robloxId, eventId }, or { username, eventId },
//        plus optional { eventId, seal }
//
// A Roblox server already knows who joined - Player.UserId and Player.Name - so it
// can ask "does this player hold a ticket for tonight?" without anybody typing a
// code at all. Send `robloxId` when you have it: it is the identity. `username` is
// there for the cases where a human is doing the typing, and it is resolved to an
// id before anything is looked up (see resolveHolderId in lib/tickets/verify.ts).
//
// READ ONLY. It changes nothing, so the game can call it as often as it likes:
// when a player joins, to show somebody their tier, to light the VIP door. Use
// /redeem when you actually want to burn the ticket.
//
// ALWAYS pass `eventId` if the server knows which show it is running. Without it
// this can only answer "is this a real ticket" - not "is this a real ticket FOR
// TONIGHT" - and a genuine ticket for last month's show comes back valid.
//
// SCOPED BY THE KEY. A partner's key sees only that partner's shows; a ticket for
// anybody else's answers not_found. There is no body field to change that.
//
// The response shape is documented in full at /llm.txt and portal.ronation.live/docs/api.

export async function POST(req: NextRequest) {
  const auth = await authorize(req, "TICKETS_VERIFY");
  if (auth instanceof NextResponse) return auth;

  // An unparseable body falls through to the bad_request below, which says what
  // was actually wanted - more use to whoever is debugging than "invalid JSON".
  const body = await readJson(req);

  const result = await checkTicket(lookupFrom(body, auth.caller));
  if (result === BAD_REQUEST) return badRequest(IDENTIFY_ERROR);

  return NextResponse.json({ ok: true, ...result });
}

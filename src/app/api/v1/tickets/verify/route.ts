import { NextRequest, NextResponse } from "next/server";
import { isValidGameKey } from "@/lib/apikey";
import { BAD_REQUEST, checkTicket } from "@/lib/tickets/verify";

export const dynamic = "force-dynamic";

// POST /api/v1/tickets/verify — is this ticket good, and what is it?
//
// Auth:  x-api-key: <GAME_API_KEY>
// Body:  { code } or { robloxId, eventId }, plus optional { eventId, seal }
//
// READ ONLY. It changes nothing, so the game can call it as often as it likes:
// when a player joins, to show somebody their tier, to light the VIP door. Use
// /redeem when you actually want to burn the ticket.
//
// ALWAYS pass `eventId` if the server knows which show it is running. Without it
// this can only answer "is this a real ticket" — not "is this a real ticket FOR
// TONIGHT" — and a genuine ticket for last month's show comes back valid.
//
// The response shape is documented in full at /llm.txt.

export async function POST(req: NextRequest) {
  if (!isValidGameKey(req)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // An unparseable body falls through to the bad_request below, which says what
    // was actually wanted — more use to whoever is debugging than "invalid JSON".
  }

  const str = (v: unknown) => (v == null ? null : String(v));

  const result = await checkTicket({
    code: str(body.code),
    robloxId: str(body.robloxId),
    eventId: str(body.eventId),
    seal: str(body.seal),
    // Deliberately unscoped: this key belongs to one deployment and is trusted
    // with whatever it asks about. The WEB door scopes by org — see verify.ts.
  });

  if (result === BAD_REQUEST) {
    return NextResponse.json(
      { ok: false, error: "provide `code`, or `robloxId` + `eventId`" },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, ...result });
}

import { NextRequest, NextResponse } from "next/server";
import { isValidGameKey } from "@/lib/apikey";
import { BAD_REQUEST, redeemTicket } from "@/lib/tickets/verify";

export const dynamic = "force-dynamic";

// POST /api/v1/tickets/redeem — burn the ticket and let them in.
//
// Auth:  x-api-key: <GAME_API_KEY>
// Body:  { code } or { robloxId, eventId }, plus optional { eventId, seal }
//
// Same body and the SAME response shape as /verify — one shape to parse in Luau,
// not two. The difference is that this one writes: a ticket that may be admitted
// comes back marked CHECKED_IN, and the next call for it says
// `admit: false, reason: "already_checked_in"`.
//
// Branch on `admit`, never on `valid`. An already-redeemed ticket is still a
// perfectly VALID ticket — it just must not let a second person through, which is
// the entire reason redeeming exists.
//
// Idempotent and race-safe: two scanners hitting the same ticket at once produce
// exactly one check-in. See redeemTicket() in lib/tickets/verify.ts.

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
    // Falls through to bad_request below.
  }

  const str = (v: unknown) => (v == null ? null : String(v));

  const result = await redeemTicket({
    code: str(body.code),
    robloxId: str(body.robloxId),
    eventId: str(body.eventId),
    seal: str(body.seal),
  });

  if (result === BAD_REQUEST) {
    return NextResponse.json(
      { ok: false, error: "provide `code`, or `robloxId` + `eventId`" },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, ...result });
}

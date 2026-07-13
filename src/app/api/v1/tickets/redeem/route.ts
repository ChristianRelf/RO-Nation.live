import { NextRequest, NextResponse } from "next/server";
import { authorize, badRequest, readJson } from "@/lib/api/guard";
import { IDENTIFY_ERROR, lookupFrom } from "@/lib/api/lookup";
import { BAD_REQUEST, redeemTicket } from "@/lib/tickets/verify";

export const dynamic = "force-dynamic";

// POST /api/v1/tickets/redeem — burn the ticket and let them in.
//
// Auth:  x-api-key: <key>          scope: TICKETS_REDEEM
// Body:  { code }, or { robloxId, eventId }, or { username, eventId },
//        plus optional { eventId, seal }
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
  const auth = await authorize(req, "TICKETS_REDEEM");
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(req);

  const result = await redeemTicket(lookupFrom(body, auth.caller));
  if (result === BAD_REQUEST) return badRequest(IDENTIFY_ERROR);

  return NextResponse.json({ ok: true, ...result });
}

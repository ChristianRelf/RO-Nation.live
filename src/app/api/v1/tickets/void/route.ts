import { NextRequest } from "next/server";
import { handleVoid } from "@/lib/api/void";

export const dynamic = "force-dynamic";

// POST /api/v1/tickets/void — cancel a ticket. The undo.
//
// Auth:  x-api-key: <key>          scope: TICKETS_VOID
// Body:  { code }, or { robloxId, eventId }, or { username, eventId }
//        plus optional { reason, byName }
//
// Issued to the wrong player. A duplicate. A change of plan. The ticket is
// cancelled and the holder is free to reserve again immediately, exactly as if
// they had cancelled it themselves — because voiding is a statement about the
// TICKET, not about the person holding it.
//
// If the person is the problem, you want /revoke.
//
// Idempotent: voiding an already-cancelled ticket succeeds and says
// `alreadyVoid: true`. It will not void a CHECKED_IN ticket — they are already in
// the room, and cancelling the record would only make it lie.

export async function POST(req: NextRequest) {
  return handleVoid(req, false);
}

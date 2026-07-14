import { NextRequest } from "next/server";
import { handleVoid } from "@/lib/api/void";

export const dynamic = "force-dynamic";

// POST /api/v1/tickets/revoke - cancel a ticket AND bar the holder from the show.
//
// Auth:  x-api-key: <key>          scope: TICKETS_VOID
// Body:  { code }, or { robloxId, eventId }, or { username, eventId }
//        plus optional { reason, byName }
//
// Everything /void does, plus the part that matters: the holder is stamped, and
// /reserve, /gift and /purchase all refuse to hand them another one for this show.
// Without that, a revoke is a gesture - they click Reserve again and walk straight
// back in.
//
// The difference is what you are saying. Voiding says "this ticket is wrong".
// Revoking says "this person is not coming". Use the second one only when you mean
// it, and send a `reason` - it is written down and it is what the crew will read
// when this person turns up at the door and asks why.
//
// It bans them from THIS SHOW. A standing ban across every show you run is the
// blacklist, in the portal - a different question, with a different answer.
//
// Lifting it is a deliberate act in the portal, not something the game can undo,
// which is on purpose: the same key that can ban should not quietly un-ban.

export async function POST(req: NextRequest) {
  return handleVoid(req, true);
}

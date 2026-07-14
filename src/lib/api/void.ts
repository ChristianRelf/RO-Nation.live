import "server-only";
import { NextResponse } from "next/server";
import { authorize, badRequest, readJson, str } from "./guard";
import { IDENTIFY_ERROR, lookupFrom, ticketEnvelope } from "./lookup";
import { VOID_MESSAGES } from "./messages";
import { voidTicket } from "@/lib/tickets/issue";
import { BAD_REQUEST, checkTicket } from "@/lib/tickets/verify";

// /void and /revoke, which are the same request with one bit flipped - so they are
// one handler, and the bit is the argument.
//
// The difference is in what happens NEXT, not in what happens now. Both cancel the
// ticket. Only a revoke stamps the holder, and only the stamp is read by
// issueTicket() when they come back and ask for another one. See voidTicket().

export async function handleVoid(req: Request, ban: boolean) {
  const auth = await authorize(req, "TICKETS_VOID");
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(req);

  // Find it exactly as /verify would - same body, same scope, same rules. A
  // partner's key cannot void a ticket it cannot see, and "cannot see" and "does
  // not exist" are the same answer.
  const found = await checkTicket(lookupFrom(body, auth.caller));
  if (found === BAD_REQUEST) return badRequest(IDENTIFY_ERROR);

  if (!found.ticket) {
    return NextResponse.json({
      ok: true,
      voided: false,
      reason: "not_found",
      message: VOID_MESSAGES.not_found,
      ticket: null,
      event: null,
      holder: null,
    });
  }

  const outcome = await voidTicket({
    ticketId: found.ticket.id,
    ban,
    reason: str(body.reason),
    // Who is doing this, in the audit trail. The key's own name, unless the caller
    // names a person - a crew member in a staff GUI is more useful than "Door
    // scanner (key)", and neither can be forged into any authority: this string is
    // written down and shown, never checked against anything.
    actorName: str(body.byName) ?? auth.caller.name,
  });

  if (!outcome.ok) {
    // The only refusal: they are already through the door. See voidTicket().
    return NextResponse.json({
      ok: true,
      voided: false,
      reason: outcome.reason,
      message: VOID_MESSAGES[outcome.reason],
      ticket: found.ticket,
      event: found.event,
      holder: found.holder,
    });
  }

  return ticketEnvelope(outcome.ticketId, auth.caller, {
    voided: true,
    /** True when the holder is now barred from taking another for this show. */
    banned: outcome.banned,
    /** True when it was ALREADY cancelled. The call still succeeded - it is idempotent. */
    alreadyVoid: outcome.alreadyVoid,
  });
}

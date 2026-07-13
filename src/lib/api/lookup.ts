import "server-only";
import { NextResponse } from "next/server";
import type { ApiCaller } from "@/lib/apikey";
import { prisma } from "@/lib/db";
import { BAD_REQUEST, checkTicket, type LookupInput } from "@/lib/tickets/verify";
import { str } from "./guard";

// How every ticket endpoint names the ticket it is talking about.
//
// One parser, shared by /verify, /redeem, /void and /revoke, so all four accept
// the identical body. That is the promise /llm.txt makes and the reason the Luau
// example has one callTicketApi() function rather than four: you learn to name a
// ticket once.

export const IDENTIFY_ERROR =
  "provide `code`, or `robloxId` + `eventId`, or `username` + `eventId`";

/**
 * Read the ticket identifiers out of a request body, and pin the lookup to the
 * caller's own org.
 *
 * `scope` comes from the KEY, never from the body — there is no field for it, and
 * that is the point. A partner's key looking up an RNL code gets "not_found": the
 * ticket is real, and it is none of their business, and those are the same answer.
 */
export function lookupFrom(
  body: Record<string, any>,
  caller: ApiCaller,
): LookupInput {
  return {
    code: str(body.code),
    robloxId: str(body.robloxId),
    username: str(body.username),
    eventId: str(body.eventId),
    seal: str(body.seal),
    scope: caller.scope,
  };
}

/**
 * Describe a ticket the way /verify describes it, whatever just happened to it.
 *
 * EVERY ticket endpoint answers in this one shape — issue, gift, purchase, void,
 * revoke, verify, redeem. A Luau integration parses `data.ticket.admission.kind`
 * once and it means the same thing everywhere, whether the ticket was just minted
 * or just scanned. Extra per-endpoint fields (`created`, `voided`…) ride alongside
 * it; they never replace it.
 *
 * It costs one re-read of the row we just wrote, which is the correct price for a
 * caller who never has to ask "which shape is this one".
 */
export async function ticketEnvelope(
  ticketId: string,
  caller: ApiCaller,
  extra: Record<string, unknown> = {},
) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { code: true },
  });

  // The row we wrote a moment ago is gone. Nothing sane produces this; say so
  // rather than inventing a ticket-shaped null.
  if (!ticket) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const result = await checkTicket({ code: ticket.code, scope: caller.scope });

  // Unreachable: BAD_REQUEST means no identifier was given, and we just gave it a
  // code. Handled anyway rather than asserted away — the day checkTicket grows a
  // new refusal, this should be a 500 that gets fixed, not a `"bad_request"`
  // string spread across a response that claims to be a ticket.
  if (result === BAD_REQUEST) {
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...extra, ...result });
}

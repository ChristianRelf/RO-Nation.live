import { NextRequest, NextResponse } from "next/server";
import { isValidGameKey } from "@/lib/apikey";
import { findTicket } from "@/lib/ticket-lookup";

export const dynamic = "force-dynamic";

// POST /api/v1/tickets/verify
// Auth: header `x-api-key: <GAME_API_KEY>`
// Body: { "code": "RN-XXXXXX" }  OR  { "robloxId": "123", "eventId": "..." }
// Returns whether the ticket is valid (i.e. reserved or checked-in, not cancelled).
export async function POST(req: NextRequest) {
  if (!isValidGameKey(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* empty body allowed for error below */
  }

  const code = body?.code ? String(body.code).trim().toUpperCase() : null;
  const robloxId = body?.robloxId ? String(body.robloxId) : null;
  const eventId = body?.eventId ? String(body.eventId) : null;

  const ticket = await findTicket({ code, robloxId, eventId });
  if (ticket === "bad_request") {
    return NextResponse.json(
      { ok: false, error: "provide `code` or `robloxId` + `eventId`" },
      { status: 400 },
    );
  }
  if (!ticket) {
    return NextResponse.json({ ok: true, valid: false, reason: "not_found" });
  }

  const valid = ticket.status !== "CANCELLED";
  return NextResponse.json({
    ok: true,
    valid,
    reason: valid ? "ok" : "cancelled",
    ticket: {
      code: ticket.code,
      status: ticket.status,
      checkedInAt: ticket.checkedInAt,
      // What they actually hold, so the door can treat a VIP as a VIP. Read from
      // the TICKET's own snapshot, not from the tier row it points at: the tier
      // may since have been renamed, re-priced or deleted, and none of that
      // changes what this person bought. NULL tier = free general admission.
      tier: ticket.tierName,
      priceRobux: ticket.priceRobux,
    },
    event: {
      id: ticket.event.id,
      slug: ticket.event.slug,
      title: ticket.event.title,
      startsAt: ticket.event.startsAt,
    },
    user: {
      robloxId: ticket.user.robloxId,
      username: ticket.user.username,
      displayName: ticket.user.displayName,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isValidGameKey } from "@/lib/apikey";
import { findTicket } from "@/lib/ticket-lookup";

export const dynamic = "force-dynamic";

// POST /api/v1/tickets/redeem
// Auth: header `x-api-key: <GAME_API_KEY>`
// Body: { "code": "RN-XXXXXX" }  OR  { "robloxId": "123", "eventId": "..." }
// Marks a valid reserved ticket as CHECKED_IN. Idempotent: re-redeeming an
// already checked-in ticket returns alreadyRedeemed: true.
export async function POST(req: NextRequest) {
  if (!isValidGameKey(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* handled below */
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
    return NextResponse.json({ ok: true, redeemed: false, reason: "not_found" });
  }
  if (ticket.status === "CANCELLED") {
    return NextResponse.json({ ok: true, redeemed: false, reason: "cancelled" });
  }
  if (ticket.status === "CHECKED_IN") {
    return NextResponse.json({
      ok: true,
      redeemed: false,
      alreadyRedeemed: true,
      checkedInAt: ticket.checkedInAt,
      user: {
        robloxId: ticket.user.robloxId,
        username: ticket.user.username,
      },
    });
  }

  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: "CHECKED_IN", checkedInAt: new Date() },
  });

  return NextResponse.json({
    ok: true,
    redeemed: true,
    checkedInAt: updated.checkedInAt,
    // The tier is the ticket's own frozen snapshot — see the note in verify.
    ticket: { code: ticket.code, tier: ticket.tierName, priceRobux: ticket.priceRobux },
    event: { id: ticket.event.id, title: ticket.event.title },
    user: {
      robloxId: ticket.user.robloxId,
      username: ticket.user.username,
      displayName: ticket.user.displayName,
    },
  });
}

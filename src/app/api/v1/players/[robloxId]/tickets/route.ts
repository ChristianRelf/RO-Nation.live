import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/api/guard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/v1/players/<robloxId>/tickets?eventId=<id|slug>
//
// Auth: x-api-key: <key>        scope: TICKETS_VERIFY
//
// "What does this player already hold?"
//
// The booth's opening question, and until now there was no way to ask it. /verify answers
// "is THIS ticket real" - it needs a code, or a player AND a show. That is the wrong shape
// for the moment a player walks up to a booth and the booth has to decide what to offer
// them, because the whole point is that it does not know yet:
//
//   nothing         → sell them a ticket.
//   General Admission → OFFER THEM THE UPGRADE. This is the sale that does not otherwise
//                     happen: the player has no idea VIP is still available, and the booth
//                     has no way to find out that they are standing in front of a GA holder.
//   VIP             → let them in, and do not try to sell them anything.
//
// `eventId` is OPTIONAL. Leave it off and you get every live ticket this player holds for
// your org - which is what a lobby board wants ("you're in for Friday"). Pass it and you get
// the one, which is what a booth wants.
//
// Cancelled tickets are NOT returned. A cancelled ticket is not a ticket, and a booth that
// saw one would refuse to sell the replacement they came to buy.

export async function GET(
  req: NextRequest,
  { params }: { params: { robloxId: string } },
) {
  const auth = await authorize(req, "TICKETS_VERIFY");
  if (auth instanceof NextResponse) return auth;

  const robloxId = params.robloxId?.trim() ?? "";
  if (!/^\d{1,20}$/.test(robloxId)) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const eventKey = req.nextUrl.searchParams.get("eventId")?.trim() || null;

  // Resolve the show first, if one was named - by id OR slug, like every other endpoint.
  let eventId: string | null = null;
  if (eventKey) {
    const event = await prisma.event.findFirst({
      where: { OR: [{ id: eventKey }, { slug: eventKey }] },
      select: { id: true, partnerId: true },
    });

    // Not there, or not this key's org's. One answer for both.
    if (!event) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    if (
      auth.caller.scope !== undefined &&
      (event.partnerId ?? null) !== auth.caller.scope
    ) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    eventId = event.id;
  }

  const tickets = await prisma.ticket.findMany({
    where: {
      user: { robloxId },
      status: { not: "CANCELLED" },
      ...(eventId ? { eventId } : {}),
      // Scoped through the EVENT, because a ticket has no partnerId of its own. Without
      // this, a partner's key would list the tickets a player holds for RNL's shows - real
      // data, none of their business.
      ...(auth.caller.scope !== undefined
        ? { event: { partnerId: auth.caller.scope } }
        : {}),
    },
    orderBy: { event: { startsAt: "asc" } },
    select: {
      id: true,
      status: true,
      tierId: true,
      tierName: true,
      priceRobux: true,
      seatKey: true,
      sectionKey: true,
      seatLabel: true,
      activatedAt: true,
      checkedInAt: true,
      event: { select: { id: true, slug: true, title: true, startsAt: true } },
    },
  });

  return NextResponse.json({
    ok: true,
    robloxId,
    tickets: tickets.map((t) => ({
      id: t.id,
      // NOT the code. A code admits somebody, and this endpoint answers a question about
      // a player rather than handing over the thing that gets them through the door -
      // /verify is where a code is checked, and it needs the code to begin with.
      status: t.status,
      tierId: t.tierId,
      // Frozen at issue, like everything else on a ticket: what they BOUGHT, whatever the
      // tier has been renamed to since.
      tier: t.tierName ?? "General Admission",
      kind: (t.priceRobux ?? 0) > 0 ? "VIP" : "GA",
      priceRobux: t.priceRobux ?? 0,
      seatKey: t.seatKey,
      sectionKey: t.sectionKey,
      seatLabel: t.seatLabel,
      activated: Boolean(t.activatedAt),
      checkedIn: Boolean(t.checkedInAt),
      event: t.event,
    })),
  });
}

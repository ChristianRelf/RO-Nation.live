import { NextRequest, NextResponse } from "next/server";
import { isValidGameKey } from "@/lib/apikey";
import { getUpcomingEvents } from "@/lib/queries";

export const dynamic = "force-dynamic";

// GET /api/v1/events   — published upcoming events with live ticket counts.
// Auth: header `x-api-key: <GAME_API_KEY>`
export async function GET(req: NextRequest) {
  if (!isValidGameKey(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const events = await getUpcomingEvents();
  return NextResponse.json({
    ok: true,
    count: events.length,
    events: events.map((e) => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      category: e.category,
      venue: e.venue,
      startsAt: e.startsAt,
      capacity: e.capacity,
      reserved: e.ticketsCount,
      remaining: e.capacity > 0 ? Math.max(0, e.capacity - e.ticketsCount) : null,
    })),
  });
}

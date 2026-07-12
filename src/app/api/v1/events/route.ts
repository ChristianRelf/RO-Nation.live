import { NextRequest, NextResponse } from "next/server";
import { isValidGameKey } from "@/lib/apikey";
import { getUpcomingEvents } from "@/lib/queries";
import { partnerBySlug } from "@/lib/partners/registry";

export const dynamic = "force-dynamic";

// GET /api/v1/events            — RNL's published upcoming events.
// GET /api/v1/events?partner=x  — partner x's, for their Roblox experience.
//
// Auth: header `x-api-key: <GAME_API_KEY>`
//
// NOTE — `partner` selects, it does not isolate. There is exactly one
// GAME_API_KEY today, so anyone holding it can read any partner's list by
// changing the query string. That is acceptable while the key lives only on
// RNL's own game servers, and it is NOT acceptable the moment a partner is
// handed the key for their own experience: at that point this endpoint needs a
// per-partner key that pins the scope server-side, the way the middleware's
// comment already assumes ("scoped by that key, not by the host it was called
// on"). Nothing sensitive is exposed either way — these are public, published
// events — but do not let a partner's key ship without closing this.
export async function GET(req: NextRequest) {
  if (!isValidGameKey(req)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const requested = req.nextUrl.searchParams.get("partner");
  if (requested && !partnerBySlug(requested)) {
    return NextResponse.json(
      { ok: false, error: "unknown_partner" },
      { status: 404 },
    );
  }

  const events = await getUpcomingEvents(requested || null);
  return NextResponse.json({
    ok: true,
    partner: requested || null,
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
      remaining:
        e.capacity > 0 ? Math.max(0, e.capacity - e.ticketsCount) : null,
    })),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/api/guard";
import { getUpcomingEvents } from "@/lib/queries";
import { partnerBySlug } from "@/lib/partners/registry";

export const dynamic = "force-dynamic";

// GET /api/v1/events            — the published upcoming shows this key can see.
// GET /api/v1/events?partner=x  — root key only; see below.
//
// Auth: x-api-key: <key>        scope: EVENTS_READ
//
// This endpoint used to carry a comment saying that `partner` *selected* but did
// not *isolate* — there was one global key, so anybody holding it could read any
// partner's list by editing the query string, and the comment said in as many
// words: do not let a partner's key ship without closing this.
//
// Closed. The scope now comes from the key. A partner's key sees that partner's
// shows and nothing else, and `?partner=` cannot widen it — asking for somebody
// else's is a 403, not a quiet redirect to your own, because silently answering a
// different question than the one asked is how an integration ships a bug that
// only appears at the door.
//
// The root env key keeps `?partner=` as a selector, exactly as before. It is
// unscoped by design and RNL's own game server uses it that way today.

export async function GET(req: NextRequest) {
  const auth = await authorize(req, "EVENTS_READ");
  if (auth instanceof NextResponse) return auth;

  const { caller } = auth;
  const requested = req.nextUrl.searchParams.get("partner");

  if (requested && !partnerBySlug(requested)) {
    return NextResponse.json({ ok: false, error: "unknown_partner" }, { status: 404 });
  }

  // A scoped key is pinned server-side. `?partner=` may only ever restate what
  // the key already is.
  if (caller.scope !== undefined) {
    if (requested && requested !== caller.scope) {
      return NextResponse.json(
        {
          ok: false,
          error: "forbidden",
          hint: `This key is scoped to ${caller.scope ?? "RO. Nation LIVE"}. It cannot read another organisation's events.`,
        },
        { status: 403 },
      );
    }
  }

  const scope = caller.scope !== undefined ? caller.scope : (requested || null);

  const events = await getUpcomingEvents(scope);
  return NextResponse.json({
    ok: true,
    partner: scope,
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

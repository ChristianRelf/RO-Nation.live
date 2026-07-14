import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { authorize } from "@/lib/api/guard";
import { prisma } from "@/lib/db";
import { seatAvailability } from "@/lib/tickets/intents";

export const dynamic = "force-dynamic";

// GET /api/v1/events/<id>/seats - what is left, right now.
//
// Auth: x-api-key: <key>        scope: EVENTS_READ
//
// A BOOTH POLLS THIS. That single fact decides everything about the shape of it.
//
// ---- It has to be cheap ----------------------------------------------------
//
// A lobby board in twenty servers, refreshing every few seconds, all night. So:
//
//   • The payload is COMPACT. Seat keys, as strings, and nothing else. No labels, no
//     coordinates, no prices - the caller already has the layout (GET /events/<id>?include=venue),
//     which is the thing that never changes. This is only the DIFF against it.
//
//   • It answers 304. An ETag over the response body, and an idle show - which is most
//     shows, most of the time - costs a hash and an empty response instead of 40KB. Send us
//     back `If-None-Match` and you will get `304 Not Modified` for as long as nothing sells.
//     A booth that ignores it still works; it just pays for what it did not need.
//
// ---- It is NOT locked, and that is correct ---------------------------------
//
// seatAvailability() takes no row lock, deliberately - the long version is in intents.ts. A
// thousand browsers and twenty game servers must not queue behind one person's checkout, so
// this is a plain read and it is SLIGHTLY STALE.
//
// That cannot cost anybody a chair. A booth may offer a seat that went half a second ago;
// POST /intents then takes the lock, finds it gone, and hands the player the next best one.
// The staleness costs one surprise. The lock and the unique index are downstream of it, and
// neither is stale.

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await authorize(req, "EVENTS_READ");
  if (auth instanceof NextResponse) return auth;

  const key = params.id?.trim();
  const missing = NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (!key) return missing;

  // By id OR slug, like the event endpoint - a game server is configured by hand, and a slug
  // is a great deal easier to not get wrong than a cuid.
  const event = await prisma.event.findFirst({
    where: { OR: [{ id: key }, { slug: key }] },
    select: { id: true, partnerId: true, seatMode: true },
  });
  if (!event) return missing;

  // Not there, or not this key's org's - one answer for both. A partner has no business
  // learning that somebody else's show exists from the shape of an error.
  const partnerId = event.partnerId ?? null;
  if (auth.caller.scope !== undefined && partnerId !== auth.caller.scope) return missing;

  const availability = await seatAvailability(event.id);
  if (!availability) return missing;

  const body = {
    ok: true,
    seatMode: availability.seatMode,
    // SOLD. These are gone for good.
    taken: availability.taken,
    // HELD - somebody is mid-checkout on them. Draw them differently if you like, but do NOT
    // offer them: a hold is a promise, and it usually becomes a ticket. If it expires the
    // seat simply reappears here.
    held: availability.held,
    // Standing areas have no chairs to count, so they get a headcount instead. `capacity: 0`
    // means uncapped BY THE AREA - the tier's cap and the room's still apply on top of it.
    sections: availability.sections,
  };

  // The ETag is over the ANSWER, not over a timestamp: two reads that say the same thing
  // must produce the same tag, or an idle show would churn a fresh one every second and the
  // 304 would never fire - which is the whole point of the header.
  const etag = `W/"${createHash("sha1").update(JSON.stringify(body)).digest("base64url")}"`;

  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { etag } });
  }

  return NextResponse.json(body, {
    headers: {
      etag,
      // No shared cache. This is per-key, live, and a CDN holding it for even a second would
      // sell the same chair twice.
      "cache-control": "no-store",
    },
  });
}

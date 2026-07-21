import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/api/guard";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { partnerBySlug } from "@/lib/partners/registry";
import { buildOffers, effectiveTiers, robuxSalesAllowed } from "@/lib/tickets/pricing";
import { isSellable, parseLayout } from "@/lib/venue/schema";
import { sectionCapacity } from "@/lib/venue/seats";

export const dynamic = "force-dynamic";

// GET /api/v1/events/<id> - one show, in full: the doors, the room, the tiers.
//
// Auth: x-api-key: <key>        scope: EVENTS_READ
//
// This is what a game server reads before it offers anybody anything. The list
// endpoint says a show exists; this says what is actually on sale in it, right
// now, with live counts - which tier ids to pass to /reserve and /purchase, what
// each costs, and how many are left.
//
// `available: false` on a tier means DO NOT PROMPT FOR IT. `blockedReason` says
// why: "soldout" (the room or the tier is full) or "locked" (it is priced, and
// Robux sales are off - so nobody can buy it today, and taking somebody's money
// for it would be taking money for a ticket that cannot be issued).
//
// The same buildOffers() the website's checkout renders from, so the game and the
// web page cannot disagree about what is left.
//
// Accepts the event's ID or its SLUG, because a game server is configured by hand
// and "stro-the-first-rite" is a great deal easier to not get wrong than
// "cmr9nedoy0001fgfa4abrsbt2".

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await authorize(req, "EVENTS_READ");
  if (auth instanceof NextResponse) return auth;

  const key = params.id?.trim();
  if (!key) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  // ?include=venue - the full layout: every polygon, every row spec, the world anchor.
  //
  // BEHIND A FLAG, and it is worth saying why rather than shipping it always-on: a lobby
  // board polling this every ten seconds for the door time does not need forty kilobytes of
  // seating geometry, and a stadium's layout is exactly that. The map is also the one thing
  // here that does NOT change - so a booth fetches it ONCE at startup, caches it for the
  // night, and then polls /events/<id>/seats (which is tiny, and 304s) for what has gone.
  const includeVenue = req.nextUrl.searchParams
    .get("include")
    ?.split(",")
    .map((s) => s.trim())
    .includes("venue");

  const event = await prisma.event.findFirst({
    where: { OR: [{ id: key }, { slug: key }] },
    include: { tiers: true, venueMap: { select: { id: true, name: true, layout: true } } },
  });

  // Not there, or not this key's org's - one answer for both. A partner has no
  // business learning that somebody else's show exists by the shape of the error.
  const missing = NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (!event) return missing;

  const partnerId = event.partnerId ?? null;
  if (auth.caller.scope !== undefined && partnerId !== auth.caller.scope) return missing;

  // Scope is the ONLY gate, and a DRAFT show is deliberately readable through it.
  //
  // There was a second check here that hid unpublished shows, and it was wrong in
  // both directions: the scope check above already means the only key that can
  // reach this event belongs to the org that owns it, so hiding their own draft
  // from their own crew (who are trying to test the show before it opens) protects
  // nobody - and the condition it was actually written with only ever fired for the
  // unscoped root key, which is the one caller that should see everything.
  //
  // Nothing leaks: `status` is in the response, so the caller knows exactly what
  // they are looking at, and issueTicket() refuses to sell a ticket to anything
  // that is not PUBLISHED regardless of what this says. The list endpoint still
  // shows published shows only, because a LIST is a shop window and this is not.

  const tickets = await prisma.ticket.groupBy({
    by: ["tierId"],
    where: { eventId: event.id, status: { not: "CANCELLED" } },
    _count: { _all: true },
  });

  const soldPerTier = new Map<string, number>();
  let sold = 0;
  for (const row of tickets) {
    soldPerTier.set(row.tierId ?? "", row._count._all);
    sold += row._count._all;
  }

  const eventRemaining =
    event.capacity > 0 ? Math.max(0, event.capacity - sold) : null;

  const offers = buildOffers({
    tiers: effectiveTiers(event.tiers),
    soldPerTier,
    eventRemaining,
    robuxAllowed: robuxSalesAllowed(partnerBySlug(partnerId), env.robuxTickets),
  });

  // The room, if it has one and it parses. A layout that does NOT parse comes back null
  // rather than as an empty room - "no map, sell it as general admission" is precisely the
  // failure parseLayout() exists to prevent, and a booth that believed it would put the
  // whole room back on sale over the top of everybody already holding a seat.
  const layout = event.venueMap ? parseLayout(event.venueMap.layout) : null;

  return NextResponse.json({
    ok: true,
    event: {
      id: event.id,
      slug: event.slug,
      title: event.title,
      tagline: event.tagline,
      category: event.category,
      status: event.status,
      // Presale: PUBLISHED and readable, but tickets are not on sale yet. Every tier
      // below is forced `available: false` with `blockedReason: "presale"`, and
      // issueTicket() refuses the buy rails - so do not prompt anything while this is
      // true. A gift/comp still works. See Event.presale.
      presale: event.presale,
      onSale: !event.presale,
      venue: event.venue,
      placeUrl: event.placeUrl,
      // The id a deep link is BUILT from:
      //   roblox.com/games/start?placeId=<this>&launchData=<intent token>
      // `placeUrl` above is what a human clicks. Two columns, not one parsed at use time -
      // see the note on Event.placeId.
      placeId: event.placeId,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      doorsAt: event.doorsAt,
      capacity: event.capacity,
      reserved: sold,
      remaining: eventRemaining,
      partnerId,

      // NONE | SECTION | SEAT.
      //
      // NONE is every show that existed before seating, and it means exactly what it always
      // did: general admission, no map, no holds needed. If it is anything else, a numbered
      // seat is being sold and POST /tickets/purchase REQUIRES an `intentToken` - you cannot
      // sell a numbered chair on the word of a game server with no idea which chair.
      seatMode: event.seatMode,
    },

    tiers: offers.map((t) => ({
      // null on the implicit tier - an event nobody configured tiers for is one
      // free General Admission. Send `tierId: null` (or leave it out) to take it.
      id: t.id,
      name: t.name,
      description: t.description,
      perks: t.perks,
      priceRobux: t.priceRobux,
      kind: t.priceRobux > 0 ? "VIP" : "GA",
      remaining: t.remaining,
      // Presale forces every tier closed regardless of stock - visible, but not on
      // sale. A caller must branch on `available`, so this is where presale is felt.
      available: event.presale ? false : !t.blockedReason,
      blockedReason: event.presale ? "presale" : t.blockedReason,

      // WHICH PRODUCT TO PROMPT. The booth needed this and had no way to get it - it was
      // holding a hand-written map of tier -> product, which drifts the first time somebody
      // re-makes a product.
      //
      // Two rails, and a tier may have BOTH, because they are the same seat sold in two
      // places (see railsFor() in pricing.ts):
      //
      //   devProductId  bought IN HERE, with PromptProductPurchase. This is yours.
      //   gamePassId    bought on the website. Listed so a board can say "also on the site",
      //                 and for no other reason: a game server cannot prompt a pass.
      devProductId: t.devProductId,
      gamePassId: t.gamePassId,
    })),

    // The sections, always - they are small, and a booth needs them to say "VIP Front, 12
    // left" without downloading the geometry. The full layout is behind ?include=venue.
    sections: layout
      ? layout.shapes.filter(isSellable).map((s) => ({
          key: s.key,
          name: s.name,
          kind: s.kind,
          tierId: s.tierId,
          capacity: sectionCapacity(s),
        }))
      : [],

    // The drawing itself, and where it IS in your world.
    //
    // `anchor` is what turns a 2D map into 3D: it is ONE affine transform for the whole room
    // (origin in studs, scale, yaw), not six floats per section - see lib/venue/anchor.ts,
    // which is twelve lines because of that decision. Null anchor = the promoter never told
    // us where the room is, so build the map flat and do not try to spawn anybody at a chair.
    venue:
      includeVenue && layout
        ? {
            id: event.venueMap!.id,
            name: event.venueMap!.name,
            layout,
          }
        : undefined,
  });
}

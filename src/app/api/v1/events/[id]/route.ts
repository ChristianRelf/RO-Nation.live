import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/api/guard";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { partnerBySlug } from "@/lib/partners/registry";
import { buildOffers, effectiveTiers, robuxSalesAllowed } from "@/lib/tickets/pricing";

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

  const event = await prisma.event.findFirst({
    where: { OR: [{ id: key }, { slug: key }] },
    include: { tiers: true },
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

  return NextResponse.json({
    ok: true,
    event: {
      id: event.id,
      slug: event.slug,
      title: event.title,
      tagline: event.tagline,
      category: event.category,
      status: event.status,
      venue: event.venue,
      placeUrl: event.placeUrl,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      doorsAt: event.doorsAt,
      capacity: event.capacity,
      reserved: sold,
      remaining: eventRemaining,
      partnerId,
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
      available: !t.blockedReason,
      blockedReason: t.blockedReason,
    })),
  });
}

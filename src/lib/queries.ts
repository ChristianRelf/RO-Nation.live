import "server-only";
import { Event, TicketStatus } from "@prisma/client";
import { prisma } from "./db";

export type EventWithCount = Event & { ticketsCount: number };

/**
 * Whose events to look at: a partner slug, or null for RO. Nation LIVE's own.
 *
 * Every query below takes this as its FIRST argument, and none of them defaults
 * it. An unscoped event query is not one that fails — it is one that puts a
 * partner's shows on RNL's homepage and RNL's shows on the partner's, and looks
 * perfectly healthy doing it. Making the scope impossible to omit is what keeps
 * that from happening the next time somebody adds a query to this file.
 */
export type EventScope = string | null;

/** Attach a live (non-cancelled) ticket count to each event in one query. */
export async function withTicketCounts(
  events: Event[],
): Promise<EventWithCount[]> {
  const ids = events.map((e) => e.id);
  if (ids.length === 0) return [];
  const grouped = await prisma.ticket.groupBy({
    by: ["eventId"],
    where: { eventId: { in: ids }, status: { not: TicketStatus.CANCELLED } },
    _count: { _all: true },
  });
  const map = new Map(grouped.map((g) => [g.eventId, g._count._all]));
  return events.map((e) => ({ ...e, ticketsCount: map.get(e.id) ?? 0 }));
}

export async function getUpcomingEvents(scope: EventScope, limit?: number) {
  const events = await prisma.event.findMany({
    where: {
      partnerId: scope,
      status: "PUBLISHED",
      startsAt: { gte: new Date() },
    },
    orderBy: { startsAt: "asc" },
    take: limit,
  });
  return withTicketCounts(events);
}

export async function getPastEvents(scope: EventScope, limit?: number) {
  const events = await prisma.event.findMany({
    where: {
      partnerId: scope,
      status: "PUBLISHED",
      startsAt: { lt: new Date() },
    },
    orderBy: { startsAt: "desc" },
    take: limit,
  });
  return withTicketCounts(events);
}

export async function getFeaturedEvent(
  scope: EventScope,
): Promise<EventWithCount | null> {
  const featured = await prisma.event.findFirst({
    where: {
      partnerId: scope,
      status: "PUBLISHED",
      featured: true,
      startsAt: { gte: new Date() },
    },
    orderBy: { startsAt: "asc" },
  });
  const chosen =
    featured ??
    (await prisma.event.findFirst({
      where: {
        partnerId: scope,
        status: "PUBLISHED",
        startsAt: { gte: new Date() },
      },
      orderBy: { startsAt: "asc" },
    }));
  if (!chosen) return null;
  const [withCount] = await withTicketCounts([chosen]);
  return withCount;
}

/**
 * Slugs are globally unique, so this *could* find the event without the scope —
 * which is precisely the trap. Fetch by slug, then reject anything belonging to
 * another org. Without that second check,
 * sleeptokenro.ronation.live/events/<an-rnl-slug> renders an RNL show in Sleep
 * Token RO's brand, with a working reserve button under it.
 */
export async function getEventBySlug(scope: EventScope, slug: string) {
  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event || event.status === "ARCHIVED") return null;
  if ((event.partnerId ?? null) !== scope) return null;
  const [withCount] = await withTicketCounts([event]);
  return withCount;
}

// ---- Careers -----------------------------------------------------
// Scoped exactly like the event queries above, and for the same reason: an
// unscoped career list is not a query that fails, it is one that advertises a
// partner's job openings on RNL's site. The scope is the first argument and has
// no default, so it cannot be forgotten.

export async function getOpenCareers(scope: EventScope) {
  return prisma.career.findMany({
    where: { partnerId: scope, status: "OPEN" },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCareerBySlug(scope: EventScope, slug: string) {
  const career = await prisma.career.findFirst({
    where: { partnerId: scope, slug },
  });
  // DRAFT and CLOSED roles are not public. CLOSED still resolves for anyone
  // holding the link, so the page can say "this one has closed" rather than 404.
  return career && career.status !== "DRAFT" ? career : null;
}

// ---- Blog --------------------------------------------------------

export async function getPublishedPosts(scope: EventScope, limit?: number) {
  return prisma.post.findMany({
    where: { partnerId: scope, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
}

export async function getPostBySlug(scope: EventScope, slug: string) {
  const post = await prisma.post.findFirst({
    where: { partnerId: scope, slug, status: "PUBLISHED" },
  });
  return post ?? null;
}

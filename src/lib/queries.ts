import "server-only";
import { Event, TicketStatus } from "@prisma/client";
import { prisma } from "./db";

export type EventWithCount = Event & { ticketsCount: number };

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

export async function getUpcomingEvents(limit?: number) {
  const events = await prisma.event.findMany({
    where: { status: "PUBLISHED", startsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    take: limit,
  });
  return withTicketCounts(events);
}

export async function getPastEvents(limit?: number) {
  const events = await prisma.event.findMany({
    where: { status: "PUBLISHED", startsAt: { lt: new Date() } },
    orderBy: { startsAt: "desc" },
    take: limit,
  });
  return withTicketCounts(events);
}

export async function getFeaturedEvent(): Promise<EventWithCount | null> {
  const featured = await prisma.event.findFirst({
    where: {
      status: "PUBLISHED",
      featured: true,
      startsAt: { gte: new Date() },
    },
    orderBy: { startsAt: "asc" },
  });
  const chosen =
    featured ??
    (await prisma.event.findFirst({
      where: { status: "PUBLISHED", startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
    }));
  if (!chosen) return null;
  const [withCount] = await withTicketCounts([chosen]);
  return withCount;
}

export async function getEventBySlug(slug: string) {
  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event || event.status === "ARCHIVED") return null;
  const [withCount] = await withTicketCounts([event]);
  return withCount;
}

export async function getOpenCareers() {
  return prisma.career.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
  });
}

import Link from "next/link";
import { prisma } from "@/lib/db";
import { AdminHeader, StatCard, Badge } from "@/components/admin-ui";
import { formatDate, relativeDays } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  await requireAdmin();
  const now = new Date();
  const [
    upcomingCount,
    publishedCount,
    ticketCount,
    openCareers,
    newApps,
    nextEvents,
    recentApps,
  ] = await Promise.all([
    prisma.event.count({
      where: { status: "PUBLISHED", startsAt: { gte: now } },
    }),
    prisma.event.count({ where: { status: "PUBLISHED" } }),
    prisma.ticket.count({ where: { status: { not: "CANCELLED" } } }),
    prisma.career.count({ where: { status: "OPEN" } }),
    prisma.application.count({ where: { status: "NEW" } }),
    prisma.event.findMany({
      where: { status: "PUBLISHED", startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 5,
      include: {
        _count: { select: { tickets: true } },
      },
    }),
    prisma.application.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { career: true },
    }),
  ]);

  return (
    <div>
      <AdminHeader
        title="Overview"
        subtitle="Everything happening across RO. Nation LIVE at a glance."
        action={{ label: "+ New event", href: "/admin/events/new" }}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Upcoming events" value={upcomingCount} hint={`${publishedCount} published total`} />
        <StatCard label="Tickets reserved" value={ticketCount} />
        <StatCard label="Open roles" value={openCareers} />
        <StatCard label="New applications" value={newApps} hint="Awaiting review" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Next events */}
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl">Next up</h2>
            <Link href="/admin/events" className="text-sm text-muted hover:text-fg">
              Manage →
            </Link>
          </div>
          {nextEvents.length ? (
            <ul className="divide-y divide-line">
              {nextEvents.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.title}</p>
                    <p className="text-xs text-muted">
                      {formatDate(e.startsAt)} · {relativeDays(e.startsAt)}
                    </p>
                  </div>
                  <Link
                    href={`/admin/events/${e.id}/attendees`}
                    className="shrink-0 text-sm text-accent"
                  >
                    {e._count.tickets} tickets
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-sm text-muted">
              No upcoming events.{" "}
              <Link href="/admin/events/new" className="text-accent">
                Create one
              </Link>
              .
            </p>
          )}
        </div>

        {/* Recent applications */}
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl">Recent applications</h2>
            <Link
              href="/admin/applications"
              className="text-sm text-muted hover:text-fg"
            >
              View all →
            </Link>
          </div>
          {recentApps.length ? (
            <ul className="divide-y divide-line">
              {recentApps.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.robloxUsername}</p>
                    <p className="truncate text-xs text-muted">
                      {a.career.title} · {formatDate(a.createdAt)}
                    </p>
                  </div>
                  <Badge value={a.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-sm text-muted">No applications yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

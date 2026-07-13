import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { AdminHeader, Badge } from "@/components/admin-ui";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteEvent } from "@/app/actions/company";
import { formatDateTime, isPast } from "@/lib/format";
import { requireCompanyUser } from "@/lib/company";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Events" };

export default async function CompanyEventsPage() {
  await requireCompanyUser();
  // RNL's own events. A partner's belong to the partner — they are managed from
  // their own portal, by their own crew, and must not be listed (or editable)
  // here just because a slug happens to live in the same table.
  const events = await prisma.event.findMany({
    where: { partnerId: null },
    orderBy: { startsAt: "desc" },
    include: { _count: { select: { tickets: true } } },
  });

  return (
    <div>
      <AdminHeader
        title="Events"
        subtitle="Draft events stay hidden. Published events appear on the site and open for tickets."
        action={{ label: "+ New event", href: "/company/events/new" }}
      />

      {events.length ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-semibold">Event</th>
                  <th className="px-5 py-3 font-semibold">When</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Tickets</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {events.map((e) => (
                  <tr key={e.id} className="hover:bg-fg/[0.02]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{e.title}</span>
                        {e.featured ? (
                          <span className="text-accent" title="Featured">
                            ★
                          </span>
                        ) : null}
                      </div>
                      <span className="text-xs text-muted">{e.category}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={isPast(e.startsAt) ? "text-faint" : ""}>
                        {formatDateTime(e.startsAt)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <Badge value={e.status} />
                    </td>
                    <td className="tnum px-5 py-4">
                      {e._count.tickets}
                      {e.capacity > 0 ? `/${e.capacity}` : ""}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/company/events/${e.id}/edit`}
                          className="text-muted hover:text-fg"
                        >
                          Edit
                        </Link>
                        <form action={deleteEvent}>
                          <input type="hidden" name="id" value={e.id} />
                          <ConfirmButton
                            className="text-faint hover:text-red-400"
                            message={`Delete "${e.title}"? This removes all its tickets too.`}
                          >
                            Delete
                          </ConfirmButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card grid place-items-center px-6 py-20 text-center">
          <p className="font-display text-2xl">No events yet</p>
          <Link href="/company/events/new" className="btn btn-accent mt-5">
            Create the first one
          </Link>
        </div>
      )}
    </div>
  );
}

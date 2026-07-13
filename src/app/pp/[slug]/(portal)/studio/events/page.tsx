import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertPartnerFeature, requirePartnerUser } from "@/lib/partners/guard";
import { partnerPortalPath } from "@/lib/partners/urls";
import { formatDateTime, isPast } from "@/lib/format";
import { StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shows" };

export default async function PartnerShowsPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await requirePartnerUser(params.slug);
  const { partner, canWrite } = user;
  assertPartnerFeature(partner, "events");

  // This partner's shows, and only theirs.
  const events = await prisma.event.findMany({
    where: { partnerId: partner.slug },
    orderBy: { startsAt: "desc" },
    include: { _count: { select: { tickets: true } } },
  });

  const base = partnerPortalPath(partner.slug, "/studio/events");

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
            Line-up
          </p>
          <h1 className="display mt-3 text-5xl">Shows</h1>
          <p className="mt-2 text-sm text-muted">
            Drafts stay hidden. Published shows appear on your site and open for
            tickets.
          </p>
        </div>

        {canWrite ? (
          <Link href={`${base}/new`} className="btn btn-accent shrink-0">
            + New show
          </Link>
        ) : null}
      </div>

      {events.length ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-semibold">Show</th>
                  <th className="px-5 py-3 font-semibold">When</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Tickets</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-fg">{e.title}</p>
                      <p className="text-xs text-faint">{e.venue ?? "Venue TBA"}</p>
                    </td>
                    <td className="tnum px-5 py-4 text-muted">
                      {formatDateTime(e.startsAt)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge
                        status={
                          e.status === "PUBLISHED"
                            ? isPast(e.startsAt)
                              ? "past"
                              : "upcoming"
                            : "closed"
                        }
                      >
                        {e.status === "PUBLISHED"
                          ? isPast(e.startsAt)
                            ? "Past"
                            : "Live"
                          : e.status === "DRAFT"
                            ? "Draft"
                            : "Archived"}
                      </StatusBadge>
                    </td>
                    <td className="tnum px-5 py-4 text-muted">
                      {e._count.tickets}
                      {e.capacity > 0 ? ` / ${e.capacity}` : ""}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {canWrite ? (
                        <Link
                          href={`${base}/${e.id}/edit`}
                          className="text-sm text-accent hover:text-fg"
                        >
                          Edit
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <p className="font-display text-2xl uppercase">No shows yet</p>
          <p className="mt-2 max-w-sm text-sm text-muted">
            {canWrite
              ? "Create your first show and it'll appear on your site once you publish it."
              : "Management hasn't announced any shows yet."}
          </p>
          {canWrite ? (
            <Link href={`${base}/new`} className="btn btn-accent mt-6">
              + New show
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import type { Event } from "@prisma/client";
import { isPast } from "@/lib/format";
import { StatusBadge } from "@/components/ui";
import { LocalTime } from "@/components/local-time";

// An org's line-up, as a table. Shared by a partner's studio and SHASHA's /shows.
//
// Extracted rather than copied for the same reason actions/studio-events.ts is one
// module rather than two: this was already the same table in the partner studio and
// on /company/events, and adding a third copy for SHASHA is how the three quietly
// stop agreeing about what "Live" means.
//
// `base` is the PUBLIC path this list is rendered at - /<slug>/studio/events, or
// /shasha/shows. Every link is built from it, so the component never has to know
// which org it is serving.

export type ShowRow = Event & { _count: { tickets: number } };

export function ShowsTable({
  events,
  base,
  canWrite,
  emptyBlurb,
}: {
  events: ShowRow[];
  base: string;
  canWrite: boolean;
  /** What "no shows" means HERE - a partner's crew and RNL's read differently. */
  emptyBlurb: string;
}) {
  if (!events.length) {
    return (
      <div className="card grid place-items-center px-6 py-16 text-center">
        <p className="font-display text-2xl uppercase">No shows yet</p>
        <p className="mt-2 max-w-sm text-sm text-muted">{emptyBlurb}</p>
        {canWrite ? (
          <Link href={`${base}/new`} className="btn btn-accent mt-6">
            + New show
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* The table scrolls inside its own box rather than widening the page -
          this is a phone tool as often as a laptop one. */}
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
                  <LocalTime value={e.startsAt} mode="datetime" />
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
                  {/* Read-only staff get the numbers and no dead link - the edit
                      page would only bounce them. Hiding it is courtesy; the
                      page's own requireScopeManager() is the lock. */}
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
  );
}

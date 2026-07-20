import type { RosterScope } from "@/lib/portal-scope";
import { getScopeAnalytics, type ShowRow } from "@/lib/partner-analytics";
import { StatCard } from "@/components/admin-ui";
import { groupCount } from "@/lib/tickets/crowd";
import { formatDate } from "@/lib/format";

// The analytics dashboard, pointed at one scope. Sits on /shasha/analytics and
// /<slug>/analytics, and - like the roster and the audit - is ONE component over
// rows discriminated by scope, so RNL and a partner read the same page of their
// own numbers. Read-only by nature: it counts, it never writes, so every role
// that can open the portal can open this.

/** A rate as a whole-number percent. */
const pct = (r: number) => `${Math.round(r * 100)}%`;

export async function ScopeAnalytics({ scope }: { scope: RosterScope }) {
  const { totals, shows } = await getScopeAnalytics(scope.eventScope);

  return (
    <section>
      <div className="mb-6 border-b border-line pb-4">
        <h2 className="font-display text-2xl uppercase">Analytics</h2>
        <p className="mt-2 text-sm text-muted">
          How {scope.name}&apos;s shows are performing - reserved against came,
          watching against going, and the tier mix. Every figure is counted, never
          estimated.
        </p>
      </div>

      {/* Headline tiles. An absent tile is a number that cannot honestly be shown
          yet (attendance before the first show, conversion with no followers), not
          a zero - see statTiles() and lib/partner-analytics.ts. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Shows produced" value={groupCount(totals.showsPast)} />
        <StatCard label="Upcoming" value={groupCount(totals.upcoming)} />
        <StatCard label="Tickets reserved" value={groupCount(totals.ticketsLive)} />
        <StatCard label="Checked in" value={groupCount(totals.checkedIn)} />
        {totals.attendanceRate !== null ? (
          <StatCard
            label="Attendance rate"
            value={pct(totals.attendanceRate)}
            hint="Of reserved seats on past shows"
          />
        ) : null}
        <StatCard label="Watching" value={groupCount(totals.followers)} />
        {totals.conversion !== null ? (
          <StatCard
            label="Watch → ticket"
            value={pct(totals.conversion)}
            hint="Followers who also hold a ticket"
          />
        ) : null}
      </div>

      {/* Per-show breakdown. */}
      <div className="mt-10">
        <h3 className="font-display text-xl uppercase">Recent shows</h3>
        {shows.length ? (
          <div className="card mt-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-5 py-3 font-semibold">Show</th>
                    <th className="px-5 py-3 font-semibold">When</th>
                    <th className="px-5 py-3 text-right font-semibold">Reserved</th>
                    <th className="px-5 py-3 text-right font-semibold">Checked in</th>
                    <th className="px-5 py-3 text-right font-semibold">Attendance</th>
                    <th className="px-5 py-3 text-right font-semibold">Watching</th>
                    <th className="px-5 py-3 font-semibold">Tiers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {shows.map((s) => (
                    <ShowRowCells key={s.id} show={s} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card mt-4 grid place-items-center px-6 py-16 text-center">
            <p className="font-display text-xl">No shows yet</p>
            <p className="mt-2 text-sm text-muted">
              Publish a show and its numbers appear here as reservations come in.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function ShowRowCells({ show: s }: { show: ShowRow }) {
  return (
    <tr className="hover:bg-fg/[0.02]">
      <td className="px-5 py-4">
        <p className="font-medium">{s.title}</p>
        <p className="text-xs text-faint">
          {s.status === "PUBLISHED" ? "" : `${s.status.toLowerCase()} · `}
          {s.capacity > 0 ? `cap ${groupCount(s.capacity)}` : "unlimited"}
        </p>
      </td>
      <td className="px-5 py-4 text-muted">{formatDate(s.startsAt)}</td>
      <td className="px-5 py-4 text-right tabular-nums">{groupCount(s.reserved)}</td>
      <td className="px-5 py-4 text-right tabular-nums">{groupCount(s.checkedIn)}</td>
      <td className="px-5 py-4 text-right tabular-nums">
        {/* Only past shows have an attendance rate - an em dash where a show has
            not happened, because "0%" would read as "nobody came" to a room that
            has not opened. */}
        {s.attendanceRate !== null ? (
          <span className="font-semibold text-fg">{Math.round(s.attendanceRate * 100)}%</span>
        ) : (
          <span className="text-faint">—</span>
        )}
      </td>
      <td className="px-5 py-4 text-right tabular-nums">{groupCount(s.watching)}</td>
      <td className="px-5 py-4">
        {s.tiers.length > 1 ? (
          <div className="flex flex-wrap gap-1.5">
            {s.tiers.map((t) => (
              <span
                key={t.name}
                className="rounded-lg border border-line bg-elev px-2 py-1 text-xs text-muted"
              >
                {t.name} <span className="ml-1 font-semibold text-fg">{t.count}</span>
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-faint">
            {s.tiers[0]?.name ?? "General Admission"}
          </span>
        )}
      </td>
    </tr>
  );
}

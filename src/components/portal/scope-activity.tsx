import type { RosterScope } from "@/lib/portal-scope";
import { findAudit, AuditTarget } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";

// Everything that happened in this org that ISN'T a roster change.
//
// Sits under <RosterAudit> on /shasha/audit and /<slug>/audit, and the split
// between the two is temporary by design. RosterAudit reads the old, typed
// RosterAudit table - which has kind/robloxId/robloxUsername columns and renders
// them as chips with a link to the profile. AuditLog is the universal one and
// flattens all that into `meta`.
//
// Both are written for now (see actions/portal.ts), so this list EXCLUDES
// ROSTER_ENTRY - without that filter every roster change would appear twice on one
// page, once well and once badly. When AuditLog has enough history to stand alone,
// this component absorbs the other and the filter goes with it. See the AuditLog
// model's comment for the deprecation.

const ACTION_STYLES: Record<string, string> = {
  CREATED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  PUBLISHED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  GRANTED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  CHECKED_IN: "border-accent/30 bg-accent/10 text-accent",
  ISSUED: "border-accent/30 bg-accent/10 text-accent",
  UPDATED: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  ARCHIVED: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  DELETED: "border-red-500/30 bg-red-500/10 text-red-300",
  REVOKED: "border-red-500/30 bg-red-500/10 text-red-300",
  VOIDED: "border-red-500/30 bg-red-500/10 text-red-300",
};

/** "ROSTER_ENTRY" → "Roster entry". The enum is a database value, not copy. */
const label = (v: string) =>
  v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, " ");

export async function ScopeActivity({ scope }: { scope: RosterScope }) {
  const rows = await findAudit([scope.id], {
    take: 100,
    target: { not: AuditTarget.ROSTER_ENTRY },
  });

  return (
    <section className="mt-12">
      <div className="mb-6 border-b border-line pb-4">
        <h2 className="font-display text-2xl uppercase">Everything else</h2>
        <p className="mt-2 text-sm text-muted">
          Shows, tickets, keys and crew access. The 100 most recent.
        </p>
      </div>

      {rows.length ? (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-bold uppercase tracking-kicker ${
                    ACTION_STYLES[row.action] ?? "border-line text-muted"
                  }`}
                >
                  {label(row.action)}
                </span>
                <span className="pill">{label(row.target)}</span>
                <span className="font-semibold text-fg">{row.targetName}</span>
                <span className="ml-auto text-xs text-faint">
                  {formatDateTime(row.createdAt)}
                </span>
              </div>

              <p className="mt-2 text-sm text-muted">{row.summary}</p>

              <p className="mt-1 text-xs text-faint">
                {row.actorName}
                {/* Which door it came through. Worth saying because the same act
                    can arrive from /company or from the portal, and "who did it"
                    is a different question from "where were they". */}
                {row.actorKind === "API" ? " · via an API key" : ""}
                {row.actorKind === "COMPANY" ? " · from /company" : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card p-8 text-center">
          <p className="text-sm text-muted">
            Nothing recorded yet. Changes to shows, tickets, keys and crew access
            will appear here as they happen.
          </p>
        </div>
      )}
    </section>
  );
}

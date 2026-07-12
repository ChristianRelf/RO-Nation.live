import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { robloxProfileUrl } from "@/lib/roblox-users";
import { requirePortalUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "History" };

const ACTION_STYLES: Record<string, string> = {
  ADDED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  UPDATED: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  REMOVED: "border-red-500/30 bg-red-500/10 text-red-300",
};

export default async function AuditPage() {
  await requirePortalUser();
  const rows = await prisma.rosterAudit.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <div className="mb-8 border-b border-line pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
          Accountability
        </p>
        <h1 className="display mt-3 text-5xl">History</h1>
        <p className="mt-2 text-sm text-muted">
          Every change to the VIP list and blacklist — who did it, to whom, and
          why. The 200 most recent are shown.
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
                  {row.action}
                </span>
                <span className="pill">
                  {row.kind === "VIP" ? "VIP" : "Blacklist"}
                </span>
                <a
                  href={robloxProfileUrl(row.robloxId)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold hover:text-accent"
                >
                  {row.robloxUsername} ↗
                </a>
                <span className="text-sm text-muted">
                  by {row.actorName}
                </span>
                <span className="ml-auto text-xs text-faint">
                  {formatDateTime(row.createdAt)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-muted">
                {row.summary}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <p className="font-display text-2xl uppercase">No history yet</p>
          <p className="mt-2 text-sm text-muted">
            Changes to the lists will be recorded here.
          </p>
        </div>
      )}
    </div>
  );
}

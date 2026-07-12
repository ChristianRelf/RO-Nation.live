import type { RosterKind } from "@prisma/client";
import { getPortalUser } from "@/lib/shasha";
import { countRoster, findRoster } from "@/lib/roster";
import { RosterAddForm } from "@/components/roster-add-form";
import { RosterList } from "@/components/roster-list";
import { RosterSearch } from "@/components/roster-search";

export type RosterSearchParams = {
  q?: string;
  ok?: string;
  error?: string;
};

const MESSAGES: Record<string, { tone: "ok" | "bad"; text: string }> = {
  added: { tone: "ok", text: "Added to the list." },
  updated: { tone: "ok", text: "Changes saved." },
  removed: { tone: "ok", text: "Removed from the list." },
  exists: { tone: "bad", text: "They're already on this list — edit them below." },
  nouser: { tone: "bad", text: "No Roblox account matched that name or ID." },
  noreason: { tone: "bad", text: "A reason is required." },
  readonly: { tone: "bad", text: "Your account has read-only access." },
};

/**
 * The VIP list and the blacklist are the same tool pointed at a different
 * `kind`, so they share one page and differ only in copy.
 */
export async function RosterPage({
  kind,
  searchParams,
}: {
  kind: RosterKind;
  searchParams: RosterSearchParams;
}) {
  const user = await getPortalUser();
  const canWrite = Boolean(user?.canWrite);

  const query = searchParams.q?.trim() || "";
  const [entries, total] = await Promise.all([
    findRoster(kind, query),
    countRoster(kind),
  ]);

  const isVip = kind === "VIP";
  const banner = MESSAGES[searchParams.ok ?? searchParams.error ?? ""];

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
            {isVip ? "Guest access" : "Enforcement"}
          </p>
          <h1 className="display mt-3 text-5xl">
            {isVip ? "VIP list" : "Blacklist"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {isVip
              ? "Players with VIP access to RO. Nation LIVE events."
              : "Players barred from RO. Nation LIVE events."}
          </p>
        </div>
        <p className="tnum shrink-0 text-sm text-faint">
          {query
            ? `${entries.length} of ${total} ${total === 1 ? "person" : "people"}`
            : `${total} ${total === 1 ? "person" : "people"}`}
        </p>
      </div>

      {banner ? (
        <p
          className={`mb-6 border px-3 py-2 text-sm ${
            banner.tone === "ok"
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {banner.text}
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-5">
          <RosterSearch
            placeholder={
              isVip
                ? "Search VIPs — username, ID, role or reason…"
                : "Search the blacklist — username, ID, tag or reason…"
            }
          />
          <RosterList entries={entries} canWrite={canWrite} query={query} />
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          {canWrite ? (
            <RosterAddForm kind={kind} />
          ) : (
            <div className="card p-6">
              <h2 className="font-display text-xl uppercase">Read only</h2>
              <p className="mt-2 text-sm text-muted">
                You can search this list, but only management can add or remove
                people. Access follows your rank in the Roblox group — if that
                looks wrong, ask management about your rank.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

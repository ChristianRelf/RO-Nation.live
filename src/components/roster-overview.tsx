import Link from "next/link";
import type { RosterScope } from "@/lib/portal-scope";
import { countRoster, findRoster, findRosterAudit } from "@/lib/roster";
import { formatDateTime } from "@/lib/format";
import { RosterSearch } from "@/components/roster-search";
import { RosterList } from "@/components/roster-list";

/**
 * The portal landing page: one search box over both lists, or - with no query -
 * the counts and the latest changes.
 *
 * Shared by SHASHA and every partner portal, scoped by `scope`. See the note at
 * the top of lib/portal-scope.ts for why these are one tool and not two.
 */
export async function RosterOverview({
  scope,
  canWrite,
  actorName,
  searchParams,
}: {
  scope: RosterScope;
  canWrite: boolean;
  actorName: string;
  searchParams: { q?: string; error?: string };
}) {
  const query = searchParams.q?.trim() || "";

  const [vipCount, blacklistCount, vipHits, blacklistHits, recent] =
    await Promise.all([
      countRoster(scope.id, "VIP"),
      countRoster(scope.id, "BLACKLIST"),
      query ? findRoster(scope.id, "VIP", query) : Promise.resolve([]),
      query ? findRoster(scope.id, "BLACKLIST", query) : Promise.resolve([]),
      findRosterAudit(scope.id, 6),
    ]);

  const vipPath = `${scope.basePath}/vip`;
  const blacklistPath = `${scope.basePath}/blacklist`;

  return (
    <div>
      <div className="mb-8 border-b border-line pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
          Signed in as {actorName}
        </p>
        <h1 className="display mt-3 text-5xl">Who are you looking for?</h1>
        <p className="mt-2 text-sm text-muted">
          Search both lists at once - by Roblox username, user ID, role or
          reason.
        </p>
      </div>

      {searchParams.error === "readonly" ? (
        <p className="mb-6 border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          Your account has read-only access - only management can change the
          lists.
        </p>
      ) : null}

      <div className="mx-auto max-w-2xl">
        <RosterSearch autoFocus />
      </div>

      {query ? (
        <div className="mt-10 space-y-10">
          {blacklistHits.length ? (
            <section>
              <SectionTitle
                title="Blacklisted"
                count={blacklistHits.length}
                href={blacklistPath}
                danger
              />
              <RosterList
                scope={scope.id}
                entries={blacklistHits}
                canWrite={canWrite}
                query={query}
              />
            </section>
          ) : null}

          <section>
            <SectionTitle
              title="VIP list"
              count={vipHits.length}
              href={vipPath}
            />
            <RosterList
              scope={scope.id}
              entries={vipHits}
              canWrite={canWrite}
              query={query}
            />
          </section>
        </div>
      ) : (
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="On the VIP list" value={vipCount} href={vipPath} />
            <StatCard
              label="Blacklisted"
              value={blacklistCount}
              href={blacklistPath}
            />
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl uppercase">Latest changes</h2>
              <Link
                href={`${scope.basePath}/audit`}
                className="text-[10px] font-bold uppercase tracking-kicker text-muted hover:text-fg"
              >
                All history →
              </Link>
            </div>

            {recent.length ? (
              <ul className="mt-4 space-y-3">
                {recent.map((row) => (
                  <li key={row.id} className="text-sm">
                    <p>
                      <span className="font-semibold">{row.actorName}</span>{" "}
                      <span className="text-muted">
                        {row.action.toLowerCase()}{" "}
                        <span className="text-fg">{row.robloxUsername}</span>{" "}
                        {row.action === "REMOVED" ? "from" : "to"} the{" "}
                        {row.kind === "VIP" ? "VIP list" : "blacklist"}
                      </span>
                    </p>
                    <p className="text-xs text-faint">
                      {formatDateTime(row.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted">
                Nothing has been changed yet.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({
  title,
  count,
  href,
  danger,
}: {
  title: string;
  count: number;
  href: string;
  danger?: boolean;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2
        className={`font-display text-2xl uppercase ${
          danger && count ? "text-red-400" : ""
        }`}
      >
        {title} <span className="tnum text-base text-faint">({count})</span>
      </h2>
      <Link
        href={href}
        className="text-[10px] font-bold uppercase tracking-kicker text-muted hover:text-fg"
      >
        Open list →
      </Link>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link href={href} className="card card-hover p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="tnum mt-2 font-display text-5xl">{value}</p>
    </Link>
  );
}

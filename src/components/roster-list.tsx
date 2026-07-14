import type { RosterEntry } from "@prisma/client";
import { ConfirmButton } from "@/components/confirm-button";
import { removeRosterEntry, updateRosterEntry } from "@/app/actions/portal";
import { formatDateTime } from "@/lib/format";
import { robloxProfileUrl } from "@/lib/utils";

export function RosterList({
  scope,
  entries,
  canWrite,
  query,
}: {
  /** Which org's list this is - travels with each write. See lib/portal-scope.ts. */
  scope: string;
  entries: RosterEntry[];
  canWrite: boolean;
  query?: string;
}) {
  if (!entries.length) {
    return (
      <div className="card grid place-items-center px-6 py-16 text-center">
        <p className="font-display text-2xl uppercase">
          {query ? "No matches" : "Nobody here yet"}
        </p>
        <p className="mt-2 max-w-sm text-sm text-muted">
          {query
            ? `Nothing on this list matches “${query}”.`
            : canWrite
              ? "Add someone using the form and they'll show up here."
              : "Management hasn't added anyone to this list yet."}
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="card p-5">
          <div className="flex flex-wrap items-start gap-4">
            {entry.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={entry.avatarUrl}
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 border border-line bg-bg object-cover"
              />
            ) : (
              <span className="h-12 w-12 shrink-0 border border-line bg-bg" />
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="font-display text-xl uppercase">
                  {entry.displayName}
                </h3>
                <a
                  href={robloxProfileUrl(entry.robloxId)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-muted hover:text-accent"
                >
                  @{entry.robloxUsername} ↗
                </a>
                <span className="tnum text-xs text-faint">
                  · {entry.robloxId}
                </span>
              </div>

              {entry.tags.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {entry.tags.map((tag) => (
                    <span key={tag} className="pill !text-fg">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              <p className="mt-2.5 whitespace-pre-line text-sm text-muted">
                {entry.reason}
              </p>

              <p className="mt-2 text-xs text-faint">
                Added by {entry.addedByName} · {formatDateTime(entry.createdAt)}
                {entry.updatedByName
                  ? ` · edited by ${entry.updatedByName} ${formatDateTime(
                      entry.updatedAt,
                    )}`
                  : ""}
              </p>
            </div>

            {canWrite ? (
              <div className="flex shrink-0 items-center gap-2">
                <form action={removeRosterEntry}>
                  <input type="hidden" name="scope" value={scope} />
                  <input type="hidden" name="id" value={entry.id} />
                  <ConfirmButton
                    message={`Remove ${entry.robloxUsername} from this list?`}
                    className="border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-red-500/40 hover:text-red-400"
                  >
                    Remove
                  </ConfirmButton>
                </form>
              </div>
            ) : null}
          </div>

          {canWrite ? (
            <details className="group mt-4 border-t border-line pt-3">
              <summary className="cursor-pointer list-none text-[10px] font-bold uppercase tracking-kicker text-faint transition-colors hover:text-fg">
                Edit roles &amp; reason
                <span className="ml-1 inline-block group-open:rotate-90">›</span>
              </summary>

              <form action={updateRosterEntry} className="mt-4 space-y-3">
                <input type="hidden" name="scope" value={scope} />
                <input type="hidden" name="id" value={entry.id} />

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Roles / tags
                  </label>
                  <input
                    name="tags"
                    defaultValue={entry.tags.join(", ")}
                    placeholder="comma, separated, roles"
                    className="w-full border border-line bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Reason
                  </label>
                  <textarea
                    name="reason"
                    required
                    rows={2}
                    maxLength={2000}
                    defaultValue={entry.reason}
                    className="w-full resize-y border border-line bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent"
                  />
                </div>

                <button className="btn btn-ghost py-2">Save changes</button>
              </form>
            </details>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

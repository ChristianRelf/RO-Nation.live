import type { FeedEntry } from "@/lib/hub-dashboard";

// What has happened lately, across every area you hold.
//
// It reads AuditLog and nothing else - there is no second table and no
// denormalised feed rows, which is why the audit trail had to exist before this
// could. See lib/audit.ts.
//
// Every line carries WHOSE it is. On one area that is noise; on four it is the
// difference between "a key was revoked" and "a key was revoked *on Sleep Token*",
// and the second is the only version worth showing.

export function ActivityFeed({ entries }: { entries: FeedEntry[] }) {
  const fresh = entries.filter((e) => e.isNew).length;

  return (
    <aside className="card p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl uppercase">Recent</h2>
        {/* A count of what is new SINCE LAST TIME, not an unread badge - it can
            only ever be as large as one visit's worth, so it stays meaningful.
            See lib/hub-seen.ts for why there is no persistent unread state. */}
        {fresh ? (
          <span className="tnum shrink-0 text-[10px] font-bold uppercase tracking-kicker text-accent">
            {fresh} new
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-faint">
        Everything you can see, newest first.
      </p>

      {entries.length ? (
        <ul className="mt-5 space-y-4">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className={
                entry.isNew
                  ? "border-l-2 border-accent pl-3"
                  : "border-l border-line pl-3"
              }
            >
              <p className="text-sm leading-snug text-muted">{entry.summary}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] font-bold uppercase tracking-kicker text-faint">
                <span className="text-accent">{entry.scopeName}</span>
                <span aria-hidden>·</span>
                <span>{entry.when}</span>
                {entry.isNew ? (
                  <span className="text-accent">· New</span>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        // The honest empty state. This is genuinely what a new portal looks like,
        // and it will also be what somebody sees for a while after this ships,
        // because the trail starts the day it starts - nothing is backfilled.
        <p className="mt-5 text-sm text-muted">
          Nothing yet. Changes to your lists, keys, crew and doors will show up
          here as they happen.
        </p>
      )}
    </aside>
  );
}

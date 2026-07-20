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
//
// It was a 360px sidebar card, which fixed the feed's width to the narrowest
// column on the page and then wrapped every summary onto three lines inside it.
// Full width and two columns, so a line is a line.

export function ActivityFeed({ entries }: { entries: FeedEntry[] }) {
  const fresh = entries.filter((e) => e.isNew).length;

  return (
    <section>
      <div className="flex items-baseline gap-3">
        <h2 className="display text-lg leading-none">Lately</h2>
        <span aria-hidden className="h-px flex-1 bg-line" />
        {/* A count of what is new SINCE LAST TIME, not an unread badge - it can
            only ever be as large as one visit's worth, so it stays meaningful.
            See lib/hub-seen.ts for why there is no persistent unread state. */}
        {fresh ? (
          <span className="tnum shrink-0 text-[10px] font-bold uppercase tracking-kicker text-accent">
            {fresh} new
          </span>
        ) : null}
      </div>

      {entries.length ? (
        <ul className="mt-5 grid gap-x-10 gap-y-0 lg:grid-cols-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="group relative flex gap-4 border-b border-line py-3.5"
            >
              {/* The marker carries "new" on its own, so the label at the end of
                  the line is a confirmation rather than the only signal. */}
              <span
                aria-hidden
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  entry.isNew ? "bg-accent" : "bg-line-strong"
                }`}
              />

              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-muted">{entry.summary}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[10px] font-bold uppercase tracking-kicker text-faint">
                  <span className={entry.isNew ? "text-accent" : "text-muted"}>
                    {entry.scopeName}
                  </span>
                  <span aria-hidden>·</span>
                  <span>{entry.when}</span>
                  {entry.isNew ? <span className="text-accent">· New</span> : null}
                </p>
              </div>
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
    </section>
  );
}

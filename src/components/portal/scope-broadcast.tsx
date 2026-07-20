import type { RosterScope } from "@/lib/portal-scope";
import { broadcastToShow } from "@/app/actions/broadcast";
import { formatDate } from "@/lib/format";

// Compose an announcement to a show's holders + followers. Shared by /shasha and a
// partner's portal, pointed at one scope - the same "one tool, many scopes" shape
// as the roster and analytics. The action guards, rate-limits and audits; this is
// just the form.

type Show = { id: string; title: string; startsAt: Date };

const inputClass =
  "w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent";

export function ScopeBroadcast({
  scope,
  shows,
  status,
}: {
  scope: RosterScope;
  /** This org's published, upcoming shows - the only ones worth announcing to. */
  shows: Show[];
  status?: { ok?: string; n?: string; error?: string };
}) {
  return (
    <section>
      <div className="mb-6 border-b border-line pb-4">
        <h2 className="font-display text-2xl uppercase">Announce</h2>
        <p className="mt-2 text-sm text-muted">
          Send a notice to everyone holding a ticket to a {scope.name} show, or
          following it. It lands on their account the next time they open the site.
          Use it for real news - a line-up, doors info - not chatter.
        </p>
      </div>

      {status?.ok ? (
        <p className="mb-6 border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300">
          Sent to {status.n ?? 0}{" "}
          {status.n === "1" ? "person" : "people"}.
        </p>
      ) : status?.error ? (
        <p className="mb-6 border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {status.error === "required"
            ? "Pick a show, and give the announcement a title and a message."
            : status.error === "slowdown"
              ? "That's a lot of announcements in a short time - give it a little while."
              : status.error === "badshow"
                ? "That show isn't one you can announce to."
                : "Something went wrong. Try again."}
        </p>
      ) : null}

      {shows.length ? (
        <form action={broadcastToShow} className="card space-y-5 p-6">
          <input type="hidden" name="scope" value={scope.id} />

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Show
            </label>
            <select name="eventId" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Pick a show…
              </option>
              {shows.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} · {formatDate(s.startsAt)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Title
            </label>
            <input
              name="title"
              required
              maxLength={120}
              placeholder="Set times are up"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Message
            </label>
            <textarea
              name="body"
              required
              rows={4}
              maxLength={1000}
              placeholder="Doors 7pm, we're on at 9. Bring your dancing shoes."
              className={`${inputClass} resize-y`}
            />
          </div>

          <div className="flex items-center gap-3">
            <button className="btn btn-accent">Send announcement</button>
            <span className="text-xs text-faint">
              Goes to holders and followers of the chosen show.
            </span>
          </div>
        </form>
      ) : (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <p className="font-display text-xl">No published shows</p>
          <p className="mt-2 max-w-sm text-sm text-muted">
            Publish a show first - there is nobody to announce to until one is live.
          </p>
        </div>
      )}
    </section>
  );
}

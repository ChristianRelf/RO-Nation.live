import type { RosterScope } from "@/lib/portal-scope";
import { inviteAttendees } from "@/app/actions/feedback";
import { formatDate } from "@/lib/format";

// Invite a past show's checked-in attendees to a survey. Shared by /shasha and a
// partner portal. Two independent selects - a past show, and an OPEN survey - and the
// action links them at send time (see actions/feedback.ts). No client JS needed.

type Show = { id: string; title: string; startsAt: Date };
type Survey = { id: string; title: string };

const inputClass =
  "w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent";

export function ScopeFeedback({
  scope,
  shows,
  surveys,
  status,
}: {
  scope: RosterScope;
  /** Past shows - the only ones with attendees to ask. */
  shows: Show[];
  /** This org's OPEN surveys - the only ones an invite could point at. */
  surveys: Survey[];
  status?: { ok?: string; n?: string; error?: string };
}) {
  const ready = shows.length > 0 && surveys.length > 0;

  return (
    <section>
      <div className="mb-6 border-b border-line pb-4">
        <h2 className="font-display text-2xl uppercase">Post-show feedback</h2>
        <p className="mt-2 text-sm text-muted">
          Ask the people who came to a {scope.name} show how it went. The invite goes
          only to those the door actually checked in, and links them straight to one of
          your open surveys. The best answers can become testimonials.
        </p>
      </div>

      {status?.ok ? (
        <p className="mb-6 border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300">
          Invited {status.n ?? 0} {status.n === "1" ? "attendee" : "attendees"}.
        </p>
      ) : status?.error ? (
        <p className="mb-6 border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {status.error === "required"
            ? "Pick both a show and a survey."
            : status.error === "slowdown"
              ? "That's a lot of invites in a short time - give it a little while."
              : status.error === "badshow"
                ? "That show isn't one you can invite from."
                : status.error === "badsurvey"
                  ? "That survey isn't open, so there's nothing to answer."
                  : "Something went wrong. Try again."}
        </p>
      ) : null}

      {ready ? (
        <form action={inviteAttendees} className="card space-y-5 p-6">
          <input type="hidden" name="scope" value={scope.id} />

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Show
            </label>
            <select name="eventId" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Pick a past show…
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
              Survey
            </label>
            <select name="surveyId" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Pick an open survey…
              </option>
              {surveys.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button className="btn btn-accent">Send the invite</button>
            <span className="text-xs text-faint">
              Goes to everyone checked in at the door for the chosen show.
            </span>
          </div>
        </form>
      ) : (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <p className="font-display text-xl">Not quite ready</p>
          <p className="mt-2 max-w-sm text-sm text-muted">
            {shows.length === 0
              ? "There are no past shows to ask about yet."
              : "Create and open a survey first, then you can invite attendees to it."}
          </p>
        </div>
      )}
    </section>
  );
}

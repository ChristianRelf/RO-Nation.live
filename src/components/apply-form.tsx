import { submitApplication } from "@/app/actions/applications";

// The "apply for this role" card, shared by RNL's careers page and every
// partner's. There is exactly one applicant-facing form, so the two cannot drift
// apart on what a valid application looks like.
//
// It posts the CAREER ID, and the action reads that career's partnerId from the
// database to decide whose inbox the application lands in. The applicant does not
// get to choose that, and nothing here is trusted to say it.

export function ApplyForm({
  career,
  session,
  discordUsername,
  returnTo,
  applied,
  error,
  closed,
  /** "We reply to everyone in the Discord." - the org's own promise. */
  note,
}: {
  career: { id: string; slug: string };
  session: { username: string } | null;
  /** The verified name on the signed-in member's linked Discord, or null if
   *  they have none yet - never text typed into this form. */
  discordUsername: string | null;
  /** Where to land back on after the Discord OAuth round trip - this page. */
  returnTo: string;
  applied?: boolean;
  error?: string;
  closed?: boolean;
  note?: string;
}) {
  return (
    <div className="card p-6">
      <h2 className="font-display text-2xl">Apply now</h2>
      <p className="mt-1 text-sm text-muted">
        {note ?? "Takes two minutes."}
      </p>

      {applied ? (
        <div className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          Application received - thank you! Keep an eye on your Roblox DMs.
        </div>
      ) : closed ? (
        <div className="mt-5 rounded-xl border border-line bg-bg px-4 py-3 text-sm text-muted">
          Applications for this role are currently closed.
        </div>
      ) : (
        <form action={submitApplication} className="mt-5 space-y-3">
          <input type="hidden" name="careerId" value={career.id} />
          <input type="hidden" name="slug" value={career.slug} />

          {error === "invalid" ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              Please add your Roblox username and a message of at least 20
              characters.
            </p>
          ) : null}
          {error === "closed" ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              This role closed while you were writing. Sorry.
            </p>
          ) : null}
          {error === "discord" ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              Connect and verify your Discord below before applying.
            </p>
          ) : null}
          {error === "discord-taken" ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              That Discord account is already linked to a different member.
              Unlink it there first, or use another account.
            </p>
          ) : null}
          {error === "discord-not-configured" ||
          error === "discord-denied" ||
          error === "discord-exchange" ||
          error === "discord-state" ||
          error === "discord-signin" ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              Couldn&apos;t connect Discord just then - please try again.
            </p>
          ) : null}

          <Field
            name="robloxUsername"
            label="Roblox username"
            required
            defaultValue={session?.username ?? ""}
            placeholder="YourRobloxName"
          />
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Discord <span className="text-accent">*</span>
            </label>
            {discordUsername ? (
              <div className="flex items-center gap-2 rounded-xl border border-line bg-bg px-4 py-2.5 text-sm">
                <span className="text-emerald-400">✓</span>
                <span>{discordUsername}</span>
                <span className="text-faint">verified</span>
              </div>
            ) : (
              <a
                href={`/api/auth/discord/login?returnTo=${encodeURIComponent(returnTo)}`}
                className="flex items-center justify-center gap-2 rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-fg transition-colors hover:border-accent"
              >
                Connect Discord to verify
              </a>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field name="timezone" label="Timezone" placeholder="GMT / EST" />
            <Field
              name="portfolio"
              label="Portfolio / links"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Why you? <span className="text-accent">*</span>
            </label>
            <textarea
              name="message"
              required
              rows={5}
              placeholder="Tell us about your experience and why this role fits you."
              className="w-full resize-none rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
            />
          </div>
          <button
            className="btn btn-accent w-full disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!discordUsername}
            title={discordUsername ? undefined : "Connect Discord to verify first"}
          >
            Submit application
          </button>
          <p className="text-center text-xs text-faint">
            By applying you agree to be contacted about this role.
          </p>
        </form>
      )}
    </div>
  );
}

function Field({
  name,
  label,
  required,
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label} {required ? <span className="text-accent">*</span> : null}
      </label>
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent"
      />
    </div>
  );
}

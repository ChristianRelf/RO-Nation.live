"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { PartnerAccountKind } from "@prisma/client";
import { submitPartnerApplication } from "@/app/actions/partner-applications";
import { PROGRAMME_OFFERS } from "@/lib/partner-program";
import { cn } from "@/lib/utils";

// The application form on partner.ronation.live/join/new.
//
// ---- What it is allowed to do, and what it is not -------------------------
//
// It counts characters, toggles the "company" fields and stops the double-submit. It does
// NOT decide anything: the length floors below are the same numbers as the zod schema in
// actions/partner-applications.ts, and if the two ever disagree the ACTION wins, because
// that is the one a hand-posted body has to get past. Everything here is courtesy.
//
// ---- Why the anonymous state renders the whole form -----------------------
//
// Submitting needs a Roblox session. The obvious build is to redirect a signed-out visitor
// to the sign-in, which is what almost every form on the web does, and it is wrong here:
// "Sign in with Roblox" as the FIRST thing a prospective commercial partner is shown, with
// no indication of what is being asked, is where people leave. So the fields render for
// everybody, the button becomes a sign-in that returns to this page, and the reason is
// said in one line above it.
//
// The fields are not disabled in that state either. Somebody who types their answers,
// signs in, and comes back to an empty form has been punished for reading. They come back
// to an empty form REGARDLESS - it is a full page navigation - which is precisely why the
// sign-in prompt sits at the BOTTOM, where they meet it after they have read the questions
// rather than before.

// The two field shapes, matching the enquiry form exactly - a partner filling this in
// has very likely just filled that one in, and two RNL forms that look different are
// two forms that look like they came from different companies.
const INPUT =
  "w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent";
const AREA =
  "w-full resize-y rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none transition-colors focus:border-accent";

const ABOUT_MIN = 40;
const ABOUT_MAX = 4000;
const WANT_MIN = 20;
const WANT_MAX = 4000;

const ERRORS: Record<string, string> = {
  session: "You need to be signed in with Roblox to send this.",
  rate: "That's several today already. Give us a chance to read the first one.",
  invalid:
    "Something in there didn't look right - check the lengths and the group link.",
  contact: "We need an email address or a Discord handle - Roblox alone isn't enough.",
  open: "You already have a request with us that we haven't answered yet.",
};

export function JoinForm({
  signedIn,
  signInHref,
  error,
}: {
  signedIn: boolean;
  /** Built on the server so it carries the right origin. */
  signInHref: string;
  error?: string;
}) {
  const [kind, setKind] = useState<PartnerAccountKind>("COMPANY");
  const [about, setAbout] = useState("");
  const [want, setWant] = useState("");

  const message = error ? (ERRORS[error] ?? ERRORS.invalid) : null;

  return (
    <form action={submitPartnerApplication} className="mt-10 space-y-10">
      {message ? (
        <p
          role="alert"
          className="rounded-brand border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {message}
        </p>
      ) : null}

      {/* ---- Who ---------------------------------------------------- */}
      <fieldset className="space-y-5">
        <Legend n="01" title="Who you are" />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" hint="The group, the label, the act - whatever goes on the site.">
            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              className={INPUT}
              placeholder="Sleep Token RO"
            />
          </Field>

          <Field label="You are" hint="It decides how many people can sign in on your behalf.">
            <div className="flex gap-2">
              {(["COMPANY", "PERSON"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  aria-pressed={kind === k}
                  className={cn(
                    "flex-1 rounded-brand border px-3 py-2 text-sm font-medium transition-colors",
                    kind === k
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line text-muted hover:border-line-strong hover:text-fg",
                  )}
                >
                  {k === "COMPANY" ? "A group or company" : "An individual"}
                </button>
              ))}
            </div>
            <input type="hidden" name="kind" value={kind} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" hint="Or a Discord handle below - we need one of the two.">
            <input
              type="email"
              name="email"
              maxLength={160}
              className={INPUT}
              placeholder="you@example.com"
            />
          </Field>
          <Field label="Discord" hint="However you'd rather we reached you.">
            <input
              name="discord"
              maxLength={80}
              className={INPUT}
              placeholder="yourhandle"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Roblox group" hint="Optional. Public link, if you run one.">
            <input
              type="url"
              name="robloxGroupUrl"
              maxLength={300}
              className={INPUT}
              placeholder="https://www.roblox.com/groups/..."
            />
          </Field>
          <Field
            label="Roughly how big"
            hint="Members, followers, a usual turnout - whichever number means something."
          >
            <input
              name="audience"
              maxLength={120}
              className={INPUT}
              placeholder="4k members, ~300 at a show"
            />
          </Field>
        </div>
      </fieldset>

      {/* ---- What ---------------------------------------------------- */}
      <fieldset className="space-y-5">
        <Legend n="02" title="What you run" />

        <Field
          label="Tell us about it"
          hint="What you put on, how often, and who turns up. Plain words are fine."
        >
          <textarea
            name="about"
            required
            rows={6}
            minLength={ABOUT_MIN}
            maxLength={ABOUT_MAX}
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            className={AREA}
            placeholder="We run a monthly club night in our own venue..."
          />
          <Counter value={about.length} min={ABOUT_MIN} max={ABOUT_MAX} />
        </Field>

        <Field
          label="What you want from us"
          hint="Be specific. 'A site and ticketing' is more useful than 'a partnership'."
        >
          <textarea
            name="want"
            required
            rows={4}
            minLength={WANT_MIN}
            maxLength={WANT_MAX}
            value={want}
            onChange={(e) => setWant(e.target.value)}
            className={AREA}
            placeholder="Mostly the production side - we can fill a room but the stage is beyond us."
          />
          <Counter value={want.length} min={WANT_MIN} max={WANT_MAX} />
        </Field>
      </fieldset>

      {/* ---- Which parts --------------------------------------------
          Rendered from the same list the programme page shows and the action
          validates against. See lib/partner-program.ts. */}
      <fieldset className="space-y-5">
        <Legend n="03" title="Which parts interest you" />
        <p className="text-sm text-muted">
          Tick anything that applies. Nothing here is binding - it tells us what the
          conversation should be about.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {PROGRAMME_OFFERS.map((offer) => (
            <label
              key={offer.id}
              className="group flex cursor-pointer gap-3 rounded-brand border border-line p-4 transition-colors hover:border-line-strong has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
            >
              <input
                type="checkbox"
                name="interests"
                value={offer.id}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{offer.title}</span>
                <span className="mt-0.5 block text-xs text-muted">{offer.summary}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* ---- Send ---------------------------------------------------- */}
      <div className="border-t border-line pt-8">
        {signedIn ? (
          <>
            <Submit />
            <p className="mt-3 text-xs text-faint">
              A person reads these. You will get a real answer, not an auto-reply.
            </p>
          </>
        ) : (
          <div className="card p-6">
            <p className="text-sm text-muted">
              One more thing: send this signed in with Roblox. It is how we know a real
              account is behind it - and it is the account that will open your partner area
              if this goes anywhere.
            </p>
            <a href={signInHref} className="btn btn-accent mt-4 w-full sm:w-auto">
              Sign in with Roblox
            </a>
            <p className="mt-3 text-xs text-faint">
              Signing in reloads this page, so copy anything you have already typed.
            </p>
          </div>
        )}
      </div>
    </form>
  );
}

function Submit() {
  // useFormStatus reads the PARENT form's state, so this has to be its own component -
  // called from inside JoinForm it would always report idle. Same shape as the pay
  // request form.
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-accent w-full sm:w-auto">
      {pending ? "Sending..." : "Send it"}
    </button>
  );
}

function Legend({ n, title }: { n: string; title: string }) {
  return (
    <legend className="flex w-full items-baseline gap-3">
      <span aria-hidden className="tnum display text-2xl leading-none text-faint">
        {n}
      </span>
      <span className="font-display text-2xl">{title}</span>
      <span aria-hidden className="h-px flex-1 bg-line" />
    </legend>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold uppercase tracking-kicker text-faint">
        {label}
      </span>
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

/** How far off the floor they are, and how close to the ceiling. Advisory only. */
function Counter({ value, min, max }: { value: number; min: number; max: number }) {
  const short = value > 0 && value < min;
  return (
    <span
      className={cn(
        "mt-1 block text-right text-[11px] tabular-nums",
        short ? "text-amber-400" : "text-faint",
      )}
    >
      {short ? `${min - value} more characters` : `${value} / ${max}`}
    </span>
  );
}

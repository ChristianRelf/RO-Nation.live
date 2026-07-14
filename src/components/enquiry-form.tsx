"use client";

import { useState } from "react";
import type { EnquiryKind } from "@prisma/client";
import { submitEnquiry } from "@/app/actions/enquiries";
import { site } from "@/lib/site";

// Write to us.
//
// Deliberately the same object as ApplyForm - the same card, the same field shapes, the
// same "sign in first" wall - because they are the same thing from a visitor's side: a
// message to RNL from somebody outside it. Two forms on one site that behave differently
// is a site that feels like two sites.
//
// A CLIENT component, and only because of one thing: the kind selector reveals the two
// booking-only fields. Everything else here would have been happy on the server.
//
// ---- The sign-in wall -----------------------------------------------------
//
// A public contact form writes straight to the production database and is the most-spammed
// object on the web. The answer here is not a captcha (a third-party script, a privacy
// policy, and a wall for anybody on a screen reader) - it is the Roblox sign-in this site
// already has, which every real visitor has already done to hold a ticket.
//
// Whoever that turns away - a journalist with no Roblox account - is handed the better
// channel instead: /press carries a plain email address, precisely so the press never
// depends on this form. Which is why the signed-out state below is a real alternative and
// not a dead end.

const KINDS: { value: EnquiryKind; label: string; blurb: string }[] = [
  {
    value: "BOOKING",
    label: "Book us",
    blurb: "You want us to build, run or ticket a show.",
  },
  {
    value: "PARTNERSHIP",
    label: "Partnership",
    blurb: "Building, music, media, or a site of your own on our platform.",
  },
  {
    value: "PRESS",
    label: "Press",
    blurb: "Interviews, quotes, screenshots, access to a show.",
  },
  { value: "GENERAL", label: "Something else", blurb: "Anything that isn't the above." },
];

export function EnquiryForm({
  session,
  defaultKind = "GENERAL",
  /**
   * The page this form is on, so submitting it lands you back HERE rather than
   * teleporting you to /contact from the middle of /services.
   *
   * The action treats it as a key into an allowlist, never as a path to redirect to - see
   * RETURNS in actions/enquiries.ts. A path taken from a form body and redirected to is
   * the exact shape of an open redirect, and the only check that cannot be outsmarted is
   * one against a fixed set of keys.
   */
  returnTo = "/contact",
  sent,
  error,
}: {
  session: { username: string } | null;
  defaultKind?: EnquiryKind;
  returnTo?: "/contact" | "/services";
  sent?: boolean;
  error?: string;
}) {
  const [kind, setKind] = useState<EnquiryKind>(defaultKind);
  const chosen = KINDS.find((k) => k.value === kind);

  if (sent) {
    return (
      <div className="card p-6">
        <h2 className="font-display text-2xl">Got it.</h2>
        <p className="mt-2 text-muted">
          That&apos;s in the inbox. Somebody will come back to you - if it&apos;s
          urgent, the Discord is always faster.
        </p>
        <a
          href={site.socials.discord}
          target="_blank"
          rel="noreferrer"
          className="btn btn-ghost mt-5"
        >
          Join the Discord
        </a>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="card p-6">
        <h2 className="font-display text-2xl">Write to us</h2>
        <p className="mt-2 text-muted">
          Sign in with Roblox to send a message. It takes one click, it means we
          know who we&apos;re talking to, and it keeps the inbox free of bots so a
          real message actually gets read.
        </p>

        {/* Back to the page they were actually on, not always /contact. */}
        <a
          href={`/api/auth/roblox?next=${encodeURIComponent(returnTo)}`}
          className="btn btn-accent mt-5"
        >
          Sign in with Roblox
        </a>

        <p className="mt-5 border-t border-line pt-5 text-sm text-muted">
          No Roblox account, or writing about us?{" "}
          <a
            href={`mailto:${site.contactEmail}`}
            className="link-underline text-accent"
          >
            {site.contactEmail}
          </a>{" "}
          reaches us just as well.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h2 className="font-display text-2xl">Write to us</h2>
      <p className="mt-1 text-sm text-muted">
        Signed in as{" "}
        <span className="font-semibold text-fg">{session.username}</span>.
      </p>

      <form action={submitEnquiry} className="mt-5 space-y-4">
        {/* The honeypot.
            A real person never sees this and never fills it in; a bot walks the DOM and
            fills everything. On a hit the action redirects to the success page and writes
            nothing at all - it is never told that it failed. See actions/enquiries.ts.

            Hidden with CSS rather than type="hidden", because a bot skips a hidden input
            and happily fills a visible-in-the-markup text one. aria-hidden and tabIndex
            keep it away from screen readers and the keyboard. */}
        <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="website">Leave this empty</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="from" value={returnTo} />

        {error ? <FormError error={error} /> : null}

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            What&apos;s this about? <span className="text-accent">*</span>
          </label>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => setKind(k.value)}
                aria-pressed={kind === k.value}
                className={`rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                  kind === k.value
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line text-muted hover:text-fg"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          {chosen ? (
            <p className="mt-1.5 text-xs text-faint">{chosen.blurb}</p>
          ) : null}
        </div>

        <Field
          name="name"
          label="Your name"
          required
          defaultValue={session.username}
          placeholder="Who are we talking to?"
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="email" label="Email" type="email" placeholder="you@example.com" />
          <Field name="discord" label="Discord" placeholder="@username" />
        </div>
        <p className="!mt-1.5 text-xs text-faint">
          One of the two, whichever you&apos;d rather we used.
        </p>

        {/* Only on a booking. A date picker and a number field would refuse "some time in
            March" and "a few hundred?", which are the honest answers at first contact -
            so both are free text, and both are optional even here. */}
        {kind === "BOOKING" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              name="eventDate"
              label="Roughly when"
              placeholder="Some time in March"
            />
            <Field
              name="scale"
              label="Roughly how big"
              placeholder="A few hundred?"
            />
          </div>
        ) : null}

        <Field
          name="subject"
          label="Subject"
          required
          placeholder={
            kind === "BOOKING"
              ? "Launch party for our group"
              : kind === "PRESS"
                ? "Interview request"
                : "What's it about?"
          }
        />

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Message <span className="text-accent">*</span>
          </label>
          <textarea
            name="message"
            required
            rows={6}
            minLength={20}
            maxLength={4000}
            placeholder={
              kind === "BOOKING"
                ? "What are you putting on, and what do you need from us? The more you tell us, the more useful the first reply is."
                : "Tell us what you need."
            }
            className="w-full resize-none rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
          />
        </div>

        <button className="btn btn-accent w-full">Send it</button>
        <p className="text-center text-xs text-faint">
          We read everything. We reply to everything that needs one.
        </p>
      </form>
    </div>
  );
}

function FormError({ error }: { error: string }) {
  const messages: Record<string, string> = {
    signin: "You need to be signed in with Roblox to send that.",
    invalid:
      "Something didn't look right - check the subject, and make the message at least 20 characters.",
    contact: "Leave us an email or a Discord, or we can't reply to you.",
    toomany:
      "You've already got a few messages waiting with us. Give us a chance to answer those first.",
  };

  return (
    <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
      {messages[error] ?? "That didn't send. Try again."}
    </p>
  );
}

function Field({
  name,
  label,
  required,
  placeholder,
  defaultValue,
  type = "text",
}: {
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label} {required ? <span className="text-accent">*</span> : null}
      </label>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent"
      />
    </div>
  );
}

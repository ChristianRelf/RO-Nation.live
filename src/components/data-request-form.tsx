"use client";

import { useState } from "react";
import Link from "next/link";
import { submitDataRequest } from "@/app/actions/data-requests";
import { DATA_REQUEST_TYPES, type DataRequestType } from "@/lib/data-request";
import { site } from "@/lib/site";

// The data-request form.
//
// Deliberately the same object as EnquiryForm and ApplyForm - the same card, field shapes,
// honeypot and "sign in first" wall - because it is the same thing from a visitor's side: a
// message to RNL from somebody outside it. It is a client component for one reason only: the
// request-type selector nudges the message placeholder. Everything else would be happy on
// the server.
//
// The wall here is not spam-prevention theatre. A data request acts on personal data, so the
// signed-in Roblox account is what proves the request is the account's own to make - see the
// long note in actions/data-requests.ts. The signed-out state is a real alternative, not a
// dead end: the contact email on /legal/data-requests handles anyone genuinely locked out.

const FORM_PATH = "/legal/data-request/request/new";

export function DataRequestForm({
  session,
  defaultType = "ACCESS",
  sent,
  error,
}: {
  session: { username: string } | null;
  defaultType?: DataRequestType["value"];
  sent?: boolean;
  error?: string;
}) {
  const [type, setType] = useState<DataRequestType["value"]>(defaultType);
  const chosen = DATA_REQUEST_TYPES.find((t) => t.value === type);

  if (sent) {
    return (
      <div className="card p-6" id="form">
        <h2 className="font-display text-2xl">Request received.</h2>
        <p className="mt-2 text-muted">
          It&apos;s with the team. We&apos;ll get back to you at the email or Discord
          you gave - to confirm it&apos;s done, or to check it&apos;s really you first.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/legal/data-requests" className="btn btn-ghost">
            How we handle it
          </Link>
          <Link href="/legal/data-request/request" className="btn btn-ghost">
            Make another
          </Link>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="card p-6" id="form">
        <h2 className="font-display text-2xl">Sign in to make a request</h2>
        <p className="mt-2 text-muted">
          A data request acts on your account, so we ask you to sign in with Roblox
          first. That&apos;s how we know the request is really yours - which is exactly
          what protects your data from somebody else asking for it.
        </p>

        <a
          href={`/api/auth/roblox?returnTo=${encodeURIComponent(FORM_PATH)}`}
          className="btn btn-accent mt-5"
        >
          Sign in with Roblox
        </a>

        <p className="mt-5 border-t border-line pt-5 text-sm text-muted">
          Locked out of your account, and it&apos;s deletion or access you need?{" "}
          <a
            href={`mailto:${site.contactEmail}`}
            className="link-underline text-accent"
          >
            {site.contactEmail}
          </a>{" "}
          reaches us, and we&apos;ll verify it&apos;s you another way.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-6" id="form">
      <h2 className="font-display text-2xl">Make a data request</h2>
      <p className="mt-1 text-sm text-muted">
        Signed in as{" "}
        <span className="font-semibold text-fg">{session.username}</span>.
      </p>

      <form action={submitDataRequest} className="mt-5 space-y-4">
        {/* The honeypot. A real person never sees this; a bot fills every input. On a hit the
            action redirects to success and writes nothing - it is never told it failed.
            Hidden with CSS not type="hidden", because a bot skips a hidden input and fills a
            visible-in-the-markup text one. */}
        <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="website">Leave this empty</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <input type="hidden" name="type" value={type} />

        {error ? <FormError error={error} /> : null}

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            What are you asking for? <span className="text-accent">*</span>
          </label>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {DATA_REQUEST_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                aria-pressed={type === t.value}
                className={`rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                  type === t.value
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line text-muted hover:text-fg"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {chosen ? (
            <p className="mt-1.5 text-xs text-faint">{chosen.blurb}</p>
          ) : null}
        </div>

        <Field
          name="robloxUsername"
          label="The Roblox account this is about"
          required
          defaultValue={session.username}
          placeholder="Your Roblox username"
        />
        <p className="!mt-1.5 text-xs text-faint">
          Defaults to the account you&apos;re signed in as - change it only if the
          request is about a different username of yours.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="email" label="Email" type="email" placeholder="you@example.com" />
          <Field name="discord" label="Discord" placeholder="@username" />
        </div>
        <p className="!mt-1.5 text-xs text-faint">
          One of the two, so we can reply and confirm it&apos;s done.
        </p>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Anything else we should know?
          </label>
          <textarea
            name="details"
            rows={5}
            maxLength={4000}
            placeholder={
              type === "CORRECT"
                ? "What's wrong, and what should it say instead?"
                : type === "DELETE"
                  ? "Anything specific, or just the whole account? (Optional)"
                  : "Optional - add anything that helps us find the right data."
            }
            className="w-full resize-none rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
          />
        </div>

        <button className="btn btn-accent w-full">Send request</button>
        <p className="text-center text-xs text-faint">
          We act on every request. See{" "}
          <Link href="/legal/data-requests" className="link-underline text-muted">
            how we handle them
          </Link>
          , including the two things we can&apos;t simply erase.
        </p>
      </form>
    </div>
  );
}

function FormError({ error }: { error: string }) {
  const messages: Record<string, string> = {
    signin: "You need to be signed in with Roblox to make a request.",
    invalid:
      "Something didn't look right - pick what you're asking for and give a Roblox username.",
    contact: "Leave us an email or a Discord, or we can't tell you when it's done.",
    toomany:
      "You've already got a request or two waiting with us. Give us a chance to answer those first.",
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

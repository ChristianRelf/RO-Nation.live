import type { Metadata } from "next";
import Link from "next/link";
import { Kicker } from "@/components/ui";
import { DATA_REQUEST_TYPES } from "@/lib/data-request";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Make a data request",
  description:
    "Ask RO. Nation LIVE for a copy of your data, correct it, or have it deleted. Sign in with Roblox and tell us what you need - we act on every request.",
};

// The landing for the request flow. It sits in front of the form (/request/new) to do one
// thing the form cannot: explain what a request means and let someone choose the right one
// before they are looking at fields. The /legal/data-requests document is the full policy -
// what we hold, who sees it, the limits on deletion; this page is the doorway to acting on it.
//
// Like every /legal page it renders unrewritten on every host (see the note in
// app/legal/page.tsx), so it carries no "back to the site" navigation that would be wrong on
// five of six hosts - only the request itself and the policy behind it.

export default function DataRequestLandingPage() {
  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-64" />

      <div className="shell relative pt-16 sm:pt-20">
        <Kicker>Your data</Kicker>
        <h1 className="display mt-5 text-5xl sm:text-6xl md:text-7xl">
          Make a request
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Ask us for a copy of what we hold, to correct it, or to delete it. Pick what
          you need, sign in with Roblox so we know it&apos;s you, and we take it from
          there.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/legal/data-request/request/new" className="btn btn-accent">
            Start a request
          </Link>
          <Link href="/legal/data-requests" className="btn btn-ghost">
            How we handle it
          </Link>
        </div>
      </div>

      <div className="shell py-14">
        <h2 className="kicker">What you can ask for</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {DATA_REQUEST_TYPES.map((t) => (
            <Link
              key={t.value}
              href={`/legal/data-request/request/new?type=${t.value}`}
              className="card card-hover group flex flex-col p-6"
            >
              <span className="font-display text-xl transition-colors group-hover:text-accent">
                {t.label}
              </span>
              <span className="mt-2 text-sm text-muted">{t.blurb}</span>
            </Link>
          ))}
        </div>

        <div className="card mt-10 p-6">
          <h2 className="font-display text-2xl">Before you do</h2>
          <p className="mt-2 text-muted">
            You&apos;ll sign in with Roblox first - that&apos;s how we&apos;re sure a
            request for your data really comes from you. We reply to the email or
            Discord you leave, to confirm it&apos;s done or to check it&apos;s you.
          </p>
          <p className="mt-3 text-muted">
            Two things we can&apos;t simply erase - a blacklist entry that protects
            other people, and a figure that no longer identifies you. Both are
            explained in full on the{" "}
            <Link href="/legal/data-requests" className="link-underline text-accent">
              data &amp; privacy requests
            </Link>{" "}
            page.
          </p>
        </div>

        <p className="mt-10 max-w-2xl text-sm text-faint">
          Locked out of your account, so you can&apos;t sign in? Email{" "}
          <a
            href={`mailto:${site.contactEmail}`}
            className="link-underline text-muted transition-colors hover:text-fg"
          >
            {site.contactEmail}
          </a>{" "}
          instead, and we&apos;ll verify it&apos;s you another way.
        </p>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ProgrammeShell } from "@/components/partner/programme-shell";
import { Kicker } from "@/components/ui";
import { PARTNER_AGREEMENTS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Request sent",
  robots: { index: false, follow: false },
};

// The landing after an application goes in.
//
// Deliberately not a modal or a green banner on the form. A page of its own means the
// browser's back button does not resubmit, the URL is something somebody can be sent, and
// there is room to answer the question everybody has at this exact moment - "so what
// happens now?" - rather than "Thanks!" and a dead end.
//
// The agreements are here for the same reason they are on the programme page: the wait is
// the one moment somebody has time to read them, and the conversation goes faster if they
// arrive at it having done so.
export default function JoinThanksPage() {
  return (
    <ProgrammeShell cta={null}>
      <div className="relative">
        <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-64" />
        <div className="shell relative max-w-2xl py-20">
          <Kicker>Sent</Kicker>
          <h1 className="display mt-5 text-5xl leading-none sm:text-6xl">
            That&apos;s with us
          </h1>
          <p className="mt-5 text-lg text-muted">
            A person reads it - usually within a few days. When we write back it will be to
            the email address or Discord handle you gave us, and it will be a real reply
            either way, including if the answer is no.
          </p>

          <div className="card mt-10 p-6">
            <h2 className="font-display text-xl">While you wait</h2>
            <p className="mt-2 text-sm text-muted">
              These are the three agreements a partnership runs on. Nothing is signed until
              both sides have been through them, and anything you want changed is easier to
              raise now than later.
            </p>
            <ul className="mt-4 space-y-2">
              {PARTNER_AGREEMENTS.map((doc) => (
                <li key={doc.href}>
                  <a
                    href={doc.href}
                    className="link-underline text-sm font-semibold text-muted transition-colors hover:text-accent"
                  >
                    {doc.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-10 border-t border-line pt-6 text-xs text-faint">
            Sent this by mistake, or need to change something in it? Say so on whichever
            channel you gave us and we will amend it - there is nothing to edit from your
            side, because there is nothing here for you to log in to yet.
          </p>

          <div className="mt-8">
            <Link href="/" className="btn btn-ghost">
              Back to the programme
            </Link>
          </div>
        </div>
      </div>
    </ProgrammeShell>
  );
}

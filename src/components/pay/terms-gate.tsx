"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  PAY_TERMS_CLAUSES,
  PAY_TERMS_CONFIRMATIONS,
  PAY_TERMS_DOCUMENTS,
  PAY_TERMS_VERSION,
} from "@/lib/accounting/pay-terms";
import { acceptPayTerms } from "@/app/actions/payments";

// The modal somebody meets before pay.ronation.live opens.
//
// ---- It is a modal, and it is also a page -------------------------------
//
// Deliberately both. It reads like a dialog - dimmed ground, one card, one decision, no nav
// to wander off into - because that is the right shape for "read this, then choose". But it
// is SERVED as its own route behind the same guard as everything else (see requirePayUser
// in lib/pay.ts), so there is no statement rendered underneath it, nothing in the RSC
// payload to read with the overlay removed, and no Escape key that reveals anything. An
// overlay in the layout would have looked identical and held nothing.
//
// There is deliberately no close button, no backdrop-click, and no "remind me later". The
// two ways out are accepting, and signing out - both of which are on the card.
//
// ---- Why the button starts disabled --------------------------------------
//
// So that accepting is an ACT rather than the path of least resistance. The server checks
// the same two boxes again (acceptPayTerms) and refuses without them, so this is the
// courtesy rather than the enforcement - but it is the half the person actually experiences,
// and a gate you pass by hitting Enter is not one anybody remembers passing.

// Bold, and only bold - the same one affordance the printed terms allow, so a clause reads
// the same here as on the paper it describes. See components/accounting/terms-block.tsx.
const BOLD = /\*\*([^*]+)\*\*/g;

function renderBold(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const m of text.matchAll(BOLD)) {
    const at = m.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    parts.push(
      <strong key={key} className="font-semibold text-fg">
        {m[1]}
      </strong>,
    );
    last = at + m[0].length;
    key++;
  }

  if (key === 0) return text;
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function PayTermsGate({
  accountName,
  displayName,
  /** Set when the server refused an unticked submission - see acceptPayTerms. */
  error,
  /** True when they HAVE accepted before, on an older version. A different sentence. */
  reaccepting,
}: {
  accountName: string;
  displayName: string;
  error?: boolean;
  reaccepting?: boolean;
}) {
  // One flag per confirmation, keyed by the same `name` the form posts - so adding a third
  // confirmation to pay-terms.ts needs no change here at all.
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);
  const allTicked = PAY_TERMS_CONFIRMATIONS.every((c) => ticked[c.name]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg/95 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pay-terms-title"
          className="card w-full max-w-2xl p-6 sm:p-8"
        >
          <p className="text-[11px] font-bold uppercase tracking-kicker text-accent">
            Before you continue
          </p>
          <h1
            id="pay-terms-title"
            className="display mt-3 text-3xl leading-none sm:text-4xl"
          >
            {reaccepting ? "Our payment terms have changed" : "Accept the payment terms"}
          </h1>

          <p className="mt-4 leading-relaxed text-muted">
            {reaccepting ? (
              <>
                We&apos;ve updated the terms for this area since you last accepted them, so
                they need reading again before {accountName}&apos;s payments will open.
              </>
            ) : (
              <>
                This is where money owed to {accountName} is requested and paid. Before it
                opens, please read these and accept them.
              </>
            )}
          </p>

          {/* The documents. Real links, and they open in a new tab on purpose: somebody
              sent away from this card mid-decision has to start again, and the boxes they
              already ticked would be gone. */}
          <div className="mt-6 divide-y divide-line border-y border-line">
            {PAY_TERMS_DOCUMENTS.map((d) => (
              <Link
                key={d.href}
                href={d.href}
                target="_blank"
                rel="noreferrer"
                className="group flex items-baseline justify-between gap-4 py-3"
              >
                <span className="min-w-0">
                  <span className="font-semibold transition-colors group-hover:text-accent">
                    {d.title}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{d.why}</span>
                </span>
                <span aria-hidden className="shrink-0 text-faint">
                  ↗
                </span>
                <span className="sr-only">(opens in a new tab)</span>
              </Link>
            ))}
          </div>

          <p className="mt-6 text-[11px] font-semibold uppercase tracking-kicker text-faint">
            In particular
          </p>
          <ul className="mt-3 space-y-2.5">
            {PAY_TERMS_CLAUSES.map((c, i) => (
              // Index as key: a frozen constant list, never reordered at runtime.
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-muted">
                <span
                  aria-hidden
                  className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-accent"
                />
                <span>{renderBold(c)}</span>
              </li>
            ))}
          </ul>

          {error ? (
            <p className="mt-6 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              Both boxes have to be ticked before we can record your acceptance.
            </p>
          ) : null}

          <form
            action={acceptPayTerms}
            onSubmit={() => setSending(true)}
            className="mt-6 border-t border-line pt-6"
          >
            <div className="space-y-3">
              {PAY_TERMS_CONFIRMATIONS.map((c) => (
                <label
                  key={c.name}
                  className="flex cursor-pointer gap-3 text-sm leading-relaxed text-muted"
                >
                  <input
                    type="checkbox"
                    name={c.name}
                    checked={Boolean(ticked[c.name])}
                    onChange={(e) =>
                      setTicked((t) => ({ ...t, [c.name]: e.target.checked }))
                    }
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={!allTicked || sending}
                className="btn btn-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? "Recording…" : "Accept and continue"}
              </button>
              {/* The other way out. Same-host, so the cookie it clears is the one set
                  here - and a person who does not accept must be able to leave without
                  the only route being the back button. */}
              <a href="/api/auth/logout?returnTo=/" className="btn">
                Not now — sign out
              </a>
            </div>

            <p className="mt-4 text-xs text-faint">
              Accepting records the date, the version, and a copy of exactly what is on this
              card, against your login ({displayName}). Version {PAY_TERMS_VERSION}.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

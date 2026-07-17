"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { acknowledgeNotifications } from "@/app/actions/notifications";
import { Celebrate } from "@/components/ticket/celebrate";

type Notice = { id: string; title: string; body: string | null; url: string | null };

// The good news dialog.
//
// The sibling of NotifierModal, and deliberately NOT a variant of it. That one exists to make
// sure a rescheduled show is READ rather than swiped past - one acknowledge button, no quiet
// dismiss, sober copy. This one exists because somebody got moved up a tier, which is the
// nicest thing that happens on this website, and it should not arrive as the third grey
// bullet in a list of admin.
//
// They are two different jobs, so they are two different components. Sharing them would mean
// one set of copy trying to be sober and delighted at once, and it would end up being neither.
//
// Which one opens is decided upstream, by `kind`, in member-notifier.tsx - and an upgrade
// always opens alone. See the note there for why the two must never share a frame.

// Above the scrim below it. The confetti canvas defaults to z-index 60, which is UNDER this
// dialog: the burst would fire flawlessly and land entirely behind 60%-black backdrop-blur,
// which on screen is indistinguishable from confetti that never fired at all.
const MODAL_Z = 100;
const CONFETTI_Z = MODAL_Z + 10;

export function UpgradeModal({ notices }: { notices: Notice[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);

  // Take focus on mount, like the checkout dialog: something has appeared over the whole
  // page and a keyboard is otherwise still tabbing around the page underneath it.
  useEffect(() => {
    dialog.current?.focus();
  }, []);

  if (!open) return null;

  const hero = notices.length === 1 ? notices[0] : null;

  async function dismiss() {
    setBusy(true);
    // Only these. There may be an ordinary notice waiting behind this one - a reschedule, a
    // cancellation - and the refresh below is what opens it. Acknowledging everything here
    // would eat it, and the member would be told about their better seat and never told the
    // show had moved.
    await acknowledgeNotifications(notices.map((n) => n.id));
    setOpen(false);
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      style={{ zIndex: MODAL_Z }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-upgrade-title"
    >
      {/* Fires once. Respects prefers-reduced-motion on its own - somebody who has asked the
          whole operating system to stop moving things has not asked for an exception for good
          news, and the dialog still says everything the confetti was saying. */}
      <Celebrate when z={CONFETTI_Z} />

      <div
        ref={dialog}
        tabIndex={-1}
        className="card relative w-full max-w-md overflow-hidden p-6 outline-none animate-fade-up"
      >
        {/* A wash of the brand accent behind the top of the card. Purely a mood - it is
            aria-hidden and carries nothing the copy does not already say. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-accent/25 blur-3xl animate-glow"
        />

        <div className="relative">
          <p className="kicker text-accent">Good news</p>

          {hero ? (
            <>
              <h2
                id="member-upgrade-title"
                className="mt-2 font-display text-3xl leading-tight"
              >
                {hero.title}
              </h2>
              {hero.body ? (
                <p className="mt-3 text-muted">{hero.body}</p>
              ) : null}
              {hero.url ? (
                <a
                  href={hero.url}
                  className="link-underline mt-4 inline-block text-sm text-accent"
                >
                  See your ticket →
                </a>
              ) : null}
            </>
          ) : (
            <>
              <h2
                id="member-upgrade-title"
                className="mt-2 font-display text-3xl leading-tight"
              >
                {notices.length} upgrades for you
              </h2>
              <ul className="mt-5 max-h-[45vh] space-y-4 overflow-y-auto">
                {notices.map((n) => (
                  <li key={n.id} className="border-l-2 border-accent pl-4">
                    <p className="font-semibold text-fg">{n.title}</p>
                    {n.body ? (
                      <p className="mt-1 text-sm text-muted">{n.body}</p>
                    ) : null}
                    {n.url ? (
                      <a
                        href={n.url}
                        className="link-underline mt-1 inline-block text-sm text-accent"
                      >
                        See your ticket →
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          )}

          <button
            type="button"
            onClick={dismiss}
            disabled={busy}
            className={`btn btn-accent mt-6 w-full ${busy ? "opacity-60" : ""}`}
          >
            {busy ? "…" : "Nice"}
          </button>
        </div>
      </div>
    </div>
  );
}

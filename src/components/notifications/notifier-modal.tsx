"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acknowledgeNotifications } from "@/app/actions/notifications";

type Notice = {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
};

// The "what changed" dialog. Shows every unseen change-notice at once; "Got it" marks them all
// seen and refreshes, so it does not pop again on the next page. Deliberately one acknowledge
// button and no quiet dismiss - the whole point is that a rescheduled or cancelled show is read,
// not swiped past.
//
// The sober one. Good news about a ticket goes to UpgradeModal instead, and never appears in
// this list - see member-notifier.tsx for why the two must not share a frame.

/**
 * What to call the link, based on where it actually goes.
 *
 * This read "View the event" for every notice, hardcoded, back when every notice WAS about an
 * event. It is now also how somebody hears their ticket moved tier - and that notice points at
 * `/tickets/<id>`, so the link cheerfully said "View the event" and opened their ticket.
 *
 * Derived from the url rather than the notice's `kind` on purpose: one kind can have two
 * destinations. TICKET_UPDATED points at the TICKET when a tier moved, and at the SHOW when the
 * ticket was voided - because a void leaves no ticket worth opening, only somewhere to go and
 * take another. The url is the only thing that always knows.
 */
function linkLabel(url: string) {
  const path = url.startsWith("http")
    ? // A partner notice is absolute (a relative /events/<slug> 404s under RNL's scope).
      (() => {
        try {
          return new URL(url).pathname;
        } catch {
          return url;
        }
      })()
    : url;
  return path.startsWith("/tickets/") ? "See your ticket →" : "View the event →";
}

export function NotifierModal({ notices }: { notices: Notice[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function dismiss() {
    setBusy(true);
    await acknowledgeNotifications();
    setOpen(false);
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-notif-title"
    >
      <div className="card w-full max-w-md p-6">
        <p className="kicker text-accent">Heads up</p>
        <h2 id="member-notif-title" className="mt-2 font-display text-2xl">
          {notices.length === 1 ? "Something's changed" : `${notices.length} updates for you`}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Changes to your tickets, and to shows you&apos;re following.
        </p>

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
                  {linkLabel(n.url)}
                </a>
              ) : null}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={dismiss}
          disabled={busy}
          className={`btn btn-accent mt-6 w-full ${busy ? "opacity-60" : ""}`}
        >
          {busy ? "…" : "Got it"}
        </button>
      </div>
    </div>
  );
}

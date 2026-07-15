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
          Changes to shows you&apos;re holding a ticket to or following.
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
                  View the event →
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

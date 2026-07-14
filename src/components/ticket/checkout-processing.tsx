"use client";

import { useEffect, useRef, useState } from "react";
import { reserveTicket } from "@/app/actions/tickets";

// The checkout step: a modal that runs the reservation and then hands you your
// ticket.
//
// The staging is deliberate. "PROCESSING PURCHASE…" then "VERIFYING TICKET…" is
// how this reads to a person, and it is also the shape the Robux flow will need -
// a payment that is prompted inside Roblox, then a receipt confirmed on the way
// back. Today there is no payment: the first stage is a free reservation, and the
// second is the ticket being minted and confirmed. The frame is right, so the day
// payments land, only what happens inside stage one changes.
//
// The reservation fires ONCE, immediately, and races the animation. The action is
// the authority - it re-resolves the tier, re-checks the Robux gate and takes the
// row lock - so this component decides nothing. It only decides how long you look
// at it: if the server is slow, the stage bar waits for it; if the server is fast,
// the bar still runs its course, because a purchase that resolves in 80ms feels
// broken rather than fast.
//
// Navigation is a hard `location.assign`, not a router push. A ticket lives on the
// host you bought it from, and on a partner's site the client router would have to
// be trusted to route through middleware to reach it. A real navigation always
// does. This is the end of a flow - one page load is not a cost worth being clever
// about.

type Stage = {
  label: string;
  /** How long this stage holds the screen. */
  min: number;
  max: number;
};

const STAGES: Stage[] = [
  { label: "Processing purchase…", min: 1000, max: 3000 },
  { label: "Verifying ticket…", min: 2000, max: 4000 },
];

const ERRORS: Record<string, string> = {
  auth: "Your session expired. Sign in again to reserve.",
  terms: "You need to accept the ticket terms before checking out.",
  badtier: "That ticket type isn't available for this show.",
  tier_soldout: "That tier sold out while you were checking out.",
  payments_off: "Paid tickets aren't switched on yet - that tier can't be issued.",
  payment_required:
    "Paid tiers are bought inside the experience. Join the show and buy it in-game.",
  revoked: "Your ticket for this show was revoked. Contact the organisers.",
  soldout: "This show just sold out.",
  past: "This show has already taken place.",
  unavailable: "This show isn't available for reservations.",
  not_found: "This show isn't available for reservations.",
};

export function CheckoutProcessing({
  eventId,
  tierId,
  eventSlug,
  eventTitle,
  tierName,
  price,
  /** Where a ticket lives on THIS host. "/tickets" for RNL and partners alike. */
  ticketBase,
  /** Back to the reserve step, if it goes wrong. */
  reserveHref,
}: {
  eventId: string;
  tierId: string;
  eventSlug: string;
  eventTitle: string;
  tierName: string;
  price: string;
  ticketBase: string;
  reserveHref: string;
}) {
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // React 18 mounts twice in dev StrictMode. Without this guard the reservation
    // is attempted twice - harmless, because the action is idempotent per account
    // and returns the existing ticket under the row lock, but it would still be
    // two rows of noise in the log for every checkout.
    if (started.current) return;
    started.current = true;

    let alive = true;

    // Each stage lasts a random time inside its window, so two people checking out
    // at once don't see an identical, obviously-canned animation.
    const held = STAGES.map((s) => s.min + Math.random() * (s.max - s.min));

    const form = new FormData();
    form.set("eventId", eventId);
    form.set("tierId", tierId);
    // The terms were accepted on the reserve step to get here. The ACTION still
    // demands this field, so the acceptance is re-asserted rather than assumed.
    form.set("terms", "on");

    const reservation = reserveTicket(null, form);

    (async () => {
      // Stage one runs on its own clock.
      await wait(held[0]);
      if (!alive) return;
      setStage(1);

      // Stage two runs alongside the real work, and does not finish before it.
      const [result] = await Promise.all([reservation, wait(held[1])]);
      if (!alive) return;

      if (!result.ok) {
        setError(ERRORS[result.error] ?? "Something went wrong. Try again.");
        return;
      }

      window.location.assign(`${ticketBase}/${result.id}?issued=1`);
    })().catch(() => {
      if (alive) setError("Something went wrong. Try again.");
    });

    return () => {
      alive = false;
    };
  }, [eventId, tierId, ticketBase]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      aria-label="Completing your order"
      className="fixed inset-0 z-[60] grid place-items-center bg-bg/90 p-6 backdrop-blur-sm"
    >
      <div className="card w-full max-w-md p-8 text-center">
        {error ? (
          <>
            <p className="kicker text-red-400">Order failed</p>
            <h1 className="display mt-4 text-3xl">We couldn&apos;t finish that</h1>
            <p className="mt-3 text-sm text-muted">{error}</p>
            <a href={reserveHref} className="btn btn-accent mt-7 w-full">
              Back to checkout
            </a>
            <a
              href={`/events/${eventSlug}`}
              className="mt-3 block text-sm text-faint transition-colors hover:text-fg"
            >
              Back to the event
            </a>
          </>
        ) : (
          <>
            <Spinner />

            <p
              className="display mt-7 text-2xl uppercase tracking-wide"
              // The label is what changes; announcing the whole dialog again
              // would have a screen reader re-read the event title each time.
              aria-live="assertive"
            >
              {STAGES[stage].label}
            </p>
            <p className="mt-2 text-sm text-muted">
              {eventTitle} · {tierName} · {price}
            </p>

            {/* The two stages, as a bar you can actually watch. */}
            <div className="mt-7 flex gap-2">
              {STAGES.map((s, i) => (
                <span
                  key={s.label}
                  className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
                    i <= stage ? "bg-accent" : "bg-line"
                  }`}
                />
              ))}
            </div>

            <p className="mt-6 text-xs text-faint">
              Don&apos;t close this window - we&apos;re issuing your ticket.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Spinner() {
  return (
    <div className="mx-auto grid h-14 w-14 place-items-center">
      <svg viewBox="0 0 50 50" className="h-14 w-14 animate-spin" aria-hidden>
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-line"
        />
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="90 126"
          className="text-accent"
        />
      </svg>
    </div>
  );
}

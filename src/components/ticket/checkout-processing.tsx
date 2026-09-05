"use client";

import { useEffect, useRef, useState } from "react";
import { reserveTicket, type ReserveState } from "@/app/actions/tickets";

// The checkout step: a modal that runs the reservation and then hands you your ticket.
//
// The staging is deliberate. "PROCESSING PURCHASE…" then "VERIFYING TICKET…" then "TICKET
// ISSUED" is how this reads to a person, and it is also the shape the Robux flow will need
// - a payment prompted inside Roblox, then a receipt confirmed on the way back. Today
// there is no payment: the first stage is a free reservation, the second is the ticket
// being minted, and the third is the beat that tells you it worked. The frame is right, so
// the day payments land, only what happens inside stage one changes.
//
// The reservation fires ONCE, immediately, and races the animation. The action is the
// authority - it re-resolves the tier, re-checks the Robux gate and takes the row lock -
// so this component decides nothing. It only decides how long you look at it: if the
// server is slow the stage bar waits for it, and if the server is fast the bar still runs
// its course, because an order that resolves in 80ms feels broken rather than fast.
//
// Navigation is a hard `location.assign`, not a router push. A ticket lives on the host you
// bought it from, and on a partner's site the client router would have to be trusted to
// route through middleware to reach it. A real navigation always does. This is the end of a
// flow - one page load is not a cost worth being clever about.
//
// ---- Two bugs this file used to have, because both will look tempting again -----
//
// 1. THE MODAL FLASHED PAST IN A FRACTION OF A SECOND. Not this file's fault: the
//    reserveTicket action called revalidatePath(), which in a Server Action re-renders the
//    route the caller is standing on - the checkout page - which redirects to the ticket it
//    had just created. The router navigated away the instant the action resolved, tearing
//    this modal down mid-animation and dropping the `?issued=1` that throws the confetti.
//    Fixed in actions/tickets.ts, where the long version of that story lives.
//
// 2. IN DEV IT WOULD THEN HAVE HUNG FOREVER. The old guard was `if (started.current)
//    return;` with a boolean. React 18 StrictMode runs an effect, tears it down, and runs
//    it again - keeping refs. So: mount one set the flag and started the chain; the fake
//    cleanup set its `alive` to false; mount two saw the flag and returned early, starting
//    nothing. The only chain in existence belonged to a dead closure, and every `if
//    (!alive) return` in it fired. The modal would have sat on "Processing purchase…"
//    until the heat death of the tab.
//
//    The fix is to keep the PROMISE in the ref rather than a boolean. The second mount
//    finds the in-flight reservation and hangs a fresh, live chain off it. The reservation
//    still fires exactly once, which is what the guard was for.

type Stage = {
  label: string;
  /** How long this stage holds the screen. */
  min: number;
  max: number;
};

const STAGES: Stage[] = [
  { label: "Processing purchase…", min: 900, max: 1500 },
  { label: "Verifying ticket…", min: 1100, max: 1700 },
];

/** The beat on "Ticket issued" before the page turns. Long enough to land, short enough
 *  not to be a wait. Without it the last thing you ever saw was "Verifying…", and the
 *  flow ended by yanking the page out from under you. */
const ISSUED_HOLD = 850;

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
  // The two seating refusals. Both send them back to the MAP, not to the tier list - the
  // thing that went wrong was the chair, and the chair is chosen there.
  bad_intent: "That seat hold is no longer valid. Pick your seat again.",
  seat_taken:
    "The last seats in that tier went while you were checking out. Pick another tier.",
  rate_limited: "You're going too fast. Wait a moment and try again.",
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
  /**
   * The seat hold, on a seated show. "" when there is nothing to hold.
   *
   * The checkout page has already proved this is a live hold of theirs (holdIsSpendable),
   * and the ACTION proves it again under the row lock. It is carried, never trusted - the
   * file this component posts to says the same about the tier id sitting next to it.
   */
  intentToken = "",
  /** Back to the seat map, when the show has one. The right retry for a seat failure. */
  seatsHref,
  /**
   * Volunteered on the reserve step, for the "you're going" confirmation email.
   * Carried exactly like intentToken - never trusted here, and re-validated by
   * the action before it is stored or mailed anywhere.
   */
  email = "",
}: {
  eventId: string;
  tierId: string;
  eventSlug: string;
  eventTitle: string;
  tierName: string;
  price: string;
  ticketBase: string;
  reserveHref: string;
  intentToken?: string;
  seatsHref?: string;
  email?: string;
}) {
  const [stage, setStage] = useState(0);
  const [issued, setIssued] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * How long each stage holds, decided once, on the client.
   *
   * State rather than a plain const, because it is RANDOM - two people checking out at the
   * same moment should not watch an identical, obviously-canned animation. A random value
   * computed during render would differ between the server's HTML and the client's first
   * paint, which is a hydration mismatch. So it is null until the effect below fills it in,
   * and the bar simply starts at zero.
   */
  const [held, setHeld] = useState<number[] | null>(null);

  /** The in-flight reservation. A promise, not a boolean - see the note at the top. */
  const reservation = useRef<Promise<ReserveState> | null>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;

    if (!reservation.current) {
      const form = new FormData();
      form.set("eventId", eventId);
      form.set("tierId", tierId);
      // The terms were accepted on the reserve step to get here. The ACTION still demands
      // this field, so the acceptance is re-asserted rather than assumed.
      form.set("terms", "on");
      // The seat they have been holding since they clicked it on the map. Spending it here
      // is what turns a hold into a chair. Empty on an unseated show - the action reads
      // that as "no hold", which is what every show that exists today is.
      form.set("intent", intentToken);
      if (email) form.set("email", email);

      reservation.current = reserveTicket(null, form);
    }
    const pending = reservation.current;

    const timings = STAGES.map((s) => s.min + Math.random() * (s.max - s.min));
    setHeld(timings);

    (async () => {
      // Stage one runs on its own clock.
      await wait(timings[0]);
      if (!alive) return;
      setStage(1);

      // Stage two runs alongside the real work, and does not finish before it. If the
      // server takes longer than the animation, the animation waits - never the reverse.
      const [result] = await Promise.all([pending, wait(timings[1])]);
      if (!alive) return;

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setIssued(true);
      await wait(ISSUED_HOLD);
      if (!alive) return;

      // A real document navigation, and it is not instant - it has to fetch a page. Say so,
      // rather than leaving a green tick sitting there looking like the flow has stalled.
      setLeaving(true);
      window.location.assign(`${ticketBase}/${result.id}?issued=1`);
    })().catch(() => {
      // A CODE, not a sentence - `error` holds a reason now, because the retry link depends
      // on which reason it is. "unknown" is in neither map, so both fall back.
      if (alive) setError("unknown");
    });

    return () => {
      alive = false;
    };
  }, [eventId, tierId, ticketBase, intentToken, email]);

  // Take the reader with us. Without this a screen-reader user is left wherever they were
  // on the page underneath, listening to a dialog they were never moved into.
  useEffect(() => {
    dialog.current?.focus();
  }, []);

  // Carry the tier back on a failure. It used to drop it, so a buyer whose reservation
  // failed for a reason that had nothing to do with their choice - a transient error, a
  // whole-show sell-out - landed back on a blank form and had to pick all over again. The
  // reserve page ignores a tier that is no longer available, so this is safe even when the
  // failure WAS the tier.
  //
  // A SEAT failure goes back to the seat map instead, because that is where the thing that
  // went wrong is chosen. `bad_intent` is a dead hold and `seat_taken` is a full tier - and
  // sending either of them back to the tier list would make the buyer re-accept the terms to
  // reach a map they were one click away from.
  const seatFailed = error === "bad_intent" || error === "seat_taken";

  const retryHref =
    seatFailed && seatsHref
      ? seatsHref
      : tierId
        ? `${reserveHref}?tier=${encodeURIComponent(tierId)}`
        : reserveHref;

  const label = leaving
    ? "Opening your ticket…"
    : issued
      ? "Ticket issued"
      : STAGES[stage].label;

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="Completing your order"
      tabIndex={-1}
      className="fixed inset-0 z-[60] grid place-items-center bg-bg/90 p-6 outline-none backdrop-blur-sm"
    >
      <div className="card w-full max-w-md p-8 text-center">
        {error ? (
          <>
            <p className="kicker text-red-400">Order failed</p>
            <h1 className="display mt-4 text-3xl">We couldn&apos;t finish that</h1>
            <p className="mt-3 text-sm text-muted">
              {ERRORS[error] ?? "Something went wrong. Try again."}
            </p>
            <a href={retryHref} className="btn btn-accent mt-7 w-full">
              {seatFailed && seatsHref ? "Back to the seat map" : "Back to checkout"}
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
            {issued ? <Tick /> : <Spinner />}

            {/* ONE live region, on the thing that actually changes.
                It used to be two - aria-live="polite" on the dialog AND aria-live="assertive"
                on this line - so every stage change announced twice, and the polite one
                re-read the event title and price along with it. */}
            <p
              aria-live="polite"
              className="display mt-7 text-2xl uppercase tracking-wide"
            >
              {label}
            </p>
            <p className="mt-2 text-sm text-muted">
              {eventTitle} · {tierName} · {price}
            </p>

            {/* The two stages, as a bar you can actually watch.
                It used to say that and not be true: each segment snapped from grey to accent
                the instant its stage began, so there was nothing to watch at all. Each one now
                FILLS over exactly as long as its stage holds - which is also why the timings
                live in state rather than in the effect's closure. */}
            <div className="mt-7 flex gap-2" aria-hidden>
              {STAGES.map((s, i) => (
                <span
                  key={s.label}
                  className="h-1 flex-1 overflow-hidden rounded-full bg-line"
                >
                  <span
                    className="block h-full origin-left rounded-full bg-accent transition-transform ease-linear"
                    style={{
                      // Filled once the stage is done or the ticket is out; filling while it
                      // is the live one; empty before that - and flat zero until `held`
                      // arrives, so the very first paint has something to animate FROM.
                      transform:
                        issued || stage > i
                          ? "scaleX(1)"
                          : held && stage === i
                            ? "scaleX(1)"
                            : "scaleX(0)",
                      transitionDuration:
                        issued || stage > i ? "220ms" : held ? `${held[i]}ms` : "0ms",
                    }}
                  />
                </span>
              ))}
            </div>

            <p className="mt-6 text-xs text-faint">
              {issued
                ? "Done - taking you to your ticket."
                : "Don't close this window - we're issuing your ticket."}
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

/** The payoff. The spinner never actually told you it had worked. */
function Tick() {
  return (
    <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border-2 border-accent bg-accent-soft">
      <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
        <path
          d="M4 12.5l5 5L20 6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-accent"
          // Drawn rather than popped in: 380ms of stroke, which is the length of the path.
          style={{
            strokeDasharray: 30,
            strokeDashoffset: 0,
            animation: "checkout-tick 380ms ease-out backwards",
          }}
        />
      </svg>
    </div>
  );
}

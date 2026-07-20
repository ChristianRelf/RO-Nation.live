// WHERE A TICKET HAS GOT TO. One function, read by everything that draws one.
//
// The detail view, the wallet, the stub and the live poller all have to agree about
// whether a ticket is dead, waiting, live or spent - and the only way four renderers
// cannot disagree is if they run the same function. Same argument as the header of
// pricing.ts, and the same reason venue-map.tsx is one renderer with three callers.
//
// PURE, and deliberately so: no prisma, no "server-only". The poller is a client
// component and has to be able to ask the same question the server just answered, or
// the screen and the truth drift apart for as long as the tab is open.
//
// ---- What this file knows that nothing else did ---------------------------
//
// `Event.doorsAt` has been stored, and formatted, and printed on the stub since the
// day it was added - and NOTHING has ever compared it to the clock. admissionWindow()
// below is that comparison. It is the whole reason a ticket can now say "doors are
// open" instead of only ever saying what time doors were supposed to be.

/**
 * How long after a show starts a ticket still gets you in, when the organiser has not
 * said when it ends.
 *
 * FOUR HOURS, and the number matters less than the fact that it is not zero. The page
 * used to compute `ended = isPast(event.startsAt)`, which told a holder who was five
 * minutes late that the show was over - at the exact moment their ticket mattered most.
 * A show does not stop admitting people the instant it begins.
 *
 * `endsAt` wins whenever it is set. This is only the fallback.
 */
export const GRACE_MS = 4 * 60 * 60 * 1000;

export type TicketPhase =
  /** Cancelled AND stamped. A ban, not an undo - and it is the PERSON, not the ticket. */
  | "revoked"
  /** Self-cancelled or voided. Nothing stops them reserving again. */
  | "cancelled"
  /** They turned up and the door let them in. */
  | "checkedIn"
  /** They never turned up, and the window has closed. Nothing left to do. */
  | "expired"
  /** Activated, doors not open yet. Ready and waiting. */
  | "armed"
  /** DOORS ARE OPEN. The one the whole page is for. */
  | "open"
  /** Reserved, not activated, doors not open yet. The ordinary resting state. */
  | "held";

type PhaseTicket = {
  status: "RESERVED" | "CHECKED_IN" | "CANCELLED";
  activatedAt: Date | null;
  revokedAt: Date | null;
};

type PhaseEvent = {
  startsAt: Date;
  doorsAt: Date | null;
  endsAt: Date | null;
};

/**
 * When this show is letting people in.
 *
 * `doorsAt ?? startsAt` because most shows do not set a doors time, and on those the
 * show starting IS the doors opening. Never the other way round: a show WITH a doors
 * time opens then, not when the headliner walks on.
 */
export function admissionWindow(event: PhaseEvent, now: number = Date.now()) {
  const opens = (event.doorsAt ?? event.startsAt).getTime();
  const closes = event.endsAt
    ? event.endsAt.getTime()
    : event.startsAt.getTime() + GRACE_MS;

  return {
    opens,
    closes,
    /** Doors have opened. Says nothing about whether they have shut again. */
    doorsOpen: now >= opens,
    /** Open AND not yet shut - the window in which a ticket actually admits you. */
    live: now >= opens && now < closes,
    closed: now >= closes,
  };
}

/**
 * ---- Why `ended` is NOT in here -------------------------------------------
 *
 * Callers still compute `ended = isPast(event.startsAt)` separately, and they must.
 *
 * `ended` is a question about the SHOW - has it begun - and it is what gates "reserve
 * again" and the cancel button. It has to keep agreeing with reserve/page.tsx, which
 * redirects on exactly `isPast(event.startsAt)`. `expired` below is a question about
 * the TICKET - is there anything left to do with it - and it deliberately answers
 * later, by GRACE_MS.
 *
 * Collapse the two into one and you get the dead-end CTA back in a new costume: a
 * ticket that still looks usable offering a reserve link the server will refuse, or a
 * latecomer told to go home. They are different questions. Keep them apart.
 */
export function ticketPhase(
  ticket: PhaseTicket,
  event: PhaseEvent,
  now: number = Date.now(),
): TicketPhase {
  // Dead first, and revoked before cancelled: a revoked ticket IS cancelled, plus a
  // stamp, so testing status alone would swallow it. The distinction is the difference
  // between "you changed your mind" and "you may not come", which is not a distinction
  // to get backwards on a page the holder reads.
  if (ticket.revokedAt) return "revoked";
  if (ticket.status === "CANCELLED") return "cancelled";
  if (ticket.status === "CHECKED_IN") return "checkedIn";

  const { doorsOpen, closed } = admissionWindow(event, now);

  // Never turned up, and the door has shut. Note this is the only place the window's
  // CLOSING is read: an unactivated ticket ten minutes after curtain-up is still
  // "open", because it still works.
  if (closed) return "expired";

  if (doorsOpen) return "open";
  return ticket.activatedAt ? "armed" : "held";
}

/** The phases where the ticket is spent or void - nothing to activate, nothing to join. */
export function isDeadPhase(phase: TicketPhase) {
  return phase === "revoked" || phase === "cancelled" || phase === "expired";
}

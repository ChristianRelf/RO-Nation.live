// A member's standing, derived from how many shows they have actually been to.
//
// ---- Why this is a pure function and not a table ---------------------------
//
// There is exactly one honest input - the number of tickets this person was
// CHECKED IN on - and it already exists, counted from door scans, indexed for the
// purpose (@@index([userId, checkedInAt]) on Ticket). A LoyaltyTier table would be
// a second copy of a number the tickets already hold, and the two would drift the
// first time a check-in was undone. So the standing is computed from the count on
// every read, and there is nothing to keep in sync.
//
// checkedInAt is the only trustworthy signal: staff can flip a ticket's status by
// hand, but the timestamp is stamped by the door and is what "been to" means. A
// reservation is an intention; a check-in is a person who turned up.
//
// This is presentation only - it unlocks nothing and gates nothing (there are no
// paid perks while Robux sales are off). It is a thank-you a regular can see, and a
// nudge - "one more show to Regular" - for the person one short of the next rung.

export type LoyaltyTier = {
  /** Stable key, for a React key or a future perk lookup. */
  key: string;
  /** What the badge says. */
  name: string;
  /** Shows attended to reach this tier. */
  min: number;
};

// The ladder. Ordered by `min` ascending; every threshold is a real count of real
// shows, so the names climb with genuine effort rather than inflating.
export const LOYALTY_TIERS: readonly LoyaltyTier[] = [
  { key: "newcomer", name: "Newcomer", min: 1 },
  { key: "regular", name: "Regular", min: 3 },
  { key: "familiar", name: "Familiar face", min: 6 },
  { key: "devotee", name: "Devotee", min: 12 },
  { key: "legend", name: "Legend", min: 25 },
];

export type LoyaltyStatus = {
  /** Shows attended - the raw count this is all derived from. */
  attended: number;
  /** The highest tier reached, or null before the first show. */
  current: LoyaltyTier | null;
  /** The next rung up, or null once at the top. */
  next: LoyaltyTier | null;
  /** Shows still to go to reach `next`, or null when there is no next. */
  toNext: number | null;
};

/**
 * The member's standing for a given attendance count.
 *
 * Returns `current: null` at zero, on purpose: someone who has never been to a
 * show has no standing to display, and a "0 shows" badge is not a softer badge, it
 * is a different and worse thing to say (the same rule statTiles() follows).
 */
export function loyaltyStatus(attended: number): LoyaltyStatus {
  let current: LoyaltyTier | null = null;
  let next: LoyaltyTier | null = null;

  for (const tier of LOYALTY_TIERS) {
    if (attended >= tier.min) current = tier;
    else {
      next = tier;
      break;
    }
  }

  return {
    attended,
    current,
    next,
    toNext: next ? next.min - attended : null,
  };
}

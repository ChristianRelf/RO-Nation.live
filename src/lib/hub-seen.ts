// "New since you were last here", without storing anything per person.
//
// ---- Why a cookie and not a column -----------------------------------------
//
// MemberNotification.seenAt exists because a member gets a handful of notices
// addressed personally to them, and each one is a thing they should act on. The
// staff feed is neither: it is a firehose addressed to nobody in particular, and an
// unread BADGE on it parks permanently at some large number and gets tuned out
// within a week - which trains people to ignore the one entry that mattered.
//
// So there is no count and no badge. There is a line in the feed, and entries above
// it are new. That needs one timestamp per browser, which is exactly what a cookie
// is, and it costs no table, no write on read, and no migration.
//
// It degrades honestly: no cookie means nothing is marked, which is the correct
// answer for somebody who has never been here rather than an error.
//
// If per-PERSON state is ever genuinely wanted (marked read on one machine showing
// as read on another), the honest upgrade is a one-row-per-staff-member table -
// AuditRead { robloxId @id, lastSeenAt } - updated in place and bounded exactly
// like RateLimit. Don't build it until somebody asks.

export const HUB_SEEN_COOKIE = "hub_seen";

/**
 * Read-only, so httpOnly is deliberate: nothing in the browser needs this value,
 * and the page it drives is server-rendered.
 *
 * Not `secure` in dev, for the same reason the session cookie isn't - the local
 * portal is plain http and a secure cookie would simply never come back.
 */
export function hubSeenCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // A year. This is a "where was I" marker, not a session - expiring it would
    // mark a wall of old entries as new, which is the one thing it must not do.
    maxAge: 60 * 60 * 24 * 365,
  };
}

/**
 * The instant this browser last looked at the hub, or null.
 *
 * Returns null for a malformed value as well as a missing one. A cookie is
 * client-supplied, and `new Date("nonsense")` is an Invalid Date that compares
 * false against everything - which would silently mark the entire feed as old.
 */
export function parseHubSeen(value: string | undefined): Date | null {
  if (!value) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
}

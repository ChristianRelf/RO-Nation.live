// "What has arrived since you were last here", for a partner.
//
// ---- The problem this solves ----------------------------------------------
//
// Issuing a document tells the partner NOTHING. There is no email address on a
// PartnerAccount, no Discord channel (DISCORD_WEBHOOK_URL_<SLUG> is per partner TENANT, a
// registry slug, which a commercial partner is not), and MemberNotification is addressed to
// ticket-holders about shows. So a payout lands in the partner's accounting and sits there
// until they happen to log in and read the whole list to work out what changed.
//
// A marker cannot make them log in. What it can do is make the visit worth something: the
// overview says how many documents have been raised since their last look, and the
// accounting list marks them - so the answer to "what's new" is a glance instead of a
// diff against memory.
//
// ---- Why a cookie, and the one difference from the hub's ------------------
//
// The reasoning in lib/hub-seen.ts applies unchanged and is not repeated here: one
// timestamp per browser, no table, no write on read, and honest degradation to "nothing is
// marked" for a browser that has never been.
//
// What differs is WHERE it advances. The hub sets its marker on the page that shows the
// feed. This one is advanced by the ACCOUNTING page only, never the overview - so landing
// on the overview and reading "2 new" does not immediately consume the thing that sent you
// to the list. The overview reports; the list is where you have actually seen them.

export const PARTNER_SEEN_COOKIE = "partner_seen";

/** Read-only marker: nothing in the browser needs the value, so httpOnly. */
export function partnerSeenCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // A year, for the reason hub-seen gives: expiring this would mark a wall of old
    // documents as new, which is the one thing it must never do.
    maxAge: 60 * 60 * 24 * 365,
  };
}

/** The instant this browser last read the accounting list, or null. */
export function parsePartnerSeen(value: string | undefined): Date | null {
  if (!value) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
}

/**
 * When a document became the partner's to see.
 *
 * `issuedAt`, not `createdAt`: a draft written three weeks ago and issued this morning is
 * new to them this morning - they could not see it before, because listDocumentsForPartner
 * Account excludes drafts. The fallback keeps a document with no issue stamp from being
 * silently permanently new.
 */
export function partnerVisibleAt(doc: {
  issuedAt: Date | null;
  createdAt: Date;
}): Date {
  return doc.issuedAt ?? doc.createdAt;
}

/** Documents raised since the marker. Empty when there is no marker - see above. */
export function countNewForPartner(
  docs: { issuedAt: Date | null; createdAt: Date }[],
  lastSeen: Date | null,
): number {
  if (!lastSeen) return 0;
  return docs.filter((d) => partnerVisibleAt(d) > lastSeen).length;
}

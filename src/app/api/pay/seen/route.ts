import { NextResponse } from "next/server";
import { getPartnerAccountUser } from "@/lib/partner-account";
import { PARTNER_SEEN_COOKIE, partnerSeenCookieOptions } from "@/lib/partner-seen";

export const dynamic = "force-dynamic";

// Advance the "you have read your statement" marker, on pay.ronation.live.
//
// ---- Why it moved off the portal host ------------------------------------
//
// It used to be /api/portal/seen/partner, set by the partner area's accounting page. That
// page is now a redirect: the statement itself lives here. And the marker HAD to move with
// it, because the cookie is host-only - a marker set on portal.ronation.live is simply not
// present on requests to this host, so the list would have gone on marking everything as
// new forever, on every visit, which is the one failure a "what's new" marker must not
// have.
//
// ---- Why it is under /api/pay -------------------------------------------
//
// PAY_PATHS in the middleware allowlists this prefix, so it is served on this host as-is.
// An endpoint outside it would be rewritten to /pay/api/… and 404 - and a fetch that
// silently 404s is exactly how a marker stops advancing without anybody noticing. The
// portal's own sibling route carries the same note for the same reason.
//
// GUARDED, even though the cookie it sets is worth nothing to anybody. "It only writes a
// timestamp" is the reasoning that ends with an unguarded endpoint doing something else
// three changes later.

export async function POST() {
  const user = await getPartnerAccountUser();
  if (!user) return new NextResponse(null, { status: 404 });

  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(
    PARTNER_SEEN_COOKIE,
    new Date().toISOString(),
    partnerSeenCookieOptions(),
  );
  return res;
}

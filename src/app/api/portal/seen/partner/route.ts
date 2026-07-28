import { NextResponse } from "next/server";
import { getPartnerAccountUser } from "@/lib/partner-account";
import { PARTNER_SEEN_COOKIE, partnerSeenCookieOptions } from "@/lib/partner-seen";

export const dynamic = "force-dynamic";

// Advance the partner area's "you have read the list" marker. The sibling of
// /api/portal/seen, and it lives UNDER that path deliberately: PORTAL_PATHS in the
// middleware allowlists the `/api/portal` prefix, and an endpoint outside it would be
// forwarded to the main site, where the route does not exist and the session cookie is not.
//
// GUARDED on the real partner guard, not on hasAnyScope() - which asks about roster scopes
// (SHASHA, partner tenants) and answers false for a commercial partner, i.e. for exactly
// the people this exists for. The cookie it sets is worth nothing, and it is still guarded,
// for the reason the sibling route gives: "it only writes a timestamp" is the reasoning
// that ends with an unguarded endpoint doing something else three changes later.

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

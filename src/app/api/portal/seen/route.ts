import { NextResponse } from "next/server";
import { hasAnyScope } from "@/lib/portal-scope";
import { HUB_SEEN_COOKIE, hubSeenCookieOptions } from "@/lib/hub-seen";

export const dynamic = "force-dynamic";

// Advance the hub's "you were last here at" marker.
//
// It is a route handler rather than part of the page render for one reason: Next 14
// forbids setting a cookie during a Server Component render. So the hub READS the
// cookie to decide which feed entries are new, and a tiny client component POSTs
// here on mount to move it forward - which also means the marker advances after
// you have seen the page, not before.
//
// GUARDED, even though the cookie it sets is worth nothing. This is a public HTTP
// endpoint on the portal host, and "it only writes a timestamp" is the reasoning
// that ends with an endpoint nobody re-reads doing something else three changes
// later. hasAnyScope() is the cheapest real check there is (it short-circuits on
// the first grant), and it is the same one app/files/[id] runs per request.

export async function POST() {
  if (!(await hasAnyScope())) {
    return new NextResponse(null, { status: 404 });
  }

  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(
    HUB_SEEN_COOKIE,
    new Date().toISOString(),
    hubSeenCookieOptions(),
  );
  return res;
}

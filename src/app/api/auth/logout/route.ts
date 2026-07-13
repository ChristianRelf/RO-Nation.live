import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE } from "@/lib/session";
import { requestOrigin } from "@/lib/origin";
import { authoriseOrigin, isAuthoriseOrigin, isKnownOrigin } from "@/lib/sso";

export const dynamic = "force-dynamic";

// Signing out has to clear TWO cookies on two hosts, and missing the second one is
// the classic single-sign-on bug: you click "sign out", the host you were on
// forgets you, you click "sign in" — and the front door still remembers you, so you
// are silently signed straight back in without a prompt. It looks like the sign-out
// button is broken, and from the user's point of view it is.
//
// So: clear the local cookie, then bounce through authorise.ronation.live to clear
// the one there, and come back.
//
// What this does NOT do is reach into the OTHER hosts you may have signed into.
// Their cookies are host-only and only they can clear them, which would mean a
// front-channel logout — an invisible iframe per host — and that is a lot of
// machinery for a staff tool. Signing out of the portal has never signed you out of
// the main site, and it still doesn't. What is fixed here is the one that would
// have been new and surprising: sign-out that doesn't stick.

function sanitizeReturn(v: string | null) {
  if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  return "/";
}

export async function GET(req: NextRequest) {
  const origin = requestOrigin(req);
  const returnTo = sanitizeReturn(req.nextUrl.searchParams.get("returnTo"));

  // ---- On the front door -------------------------------------------
  // The end of the chain. Clear the identity itself, then send them back to the
  // host they started on — validated, because it is a redirect target that came in
  // on a query string.
  if (isAuthoriseOrigin(origin)) {
    const to = req.nextUrl.searchParams.get("to") ?? "";
    const target = isKnownOrigin(to)
      ? new URL(returnTo, to)
      : new URL(returnTo, origin);

    const res = NextResponse.redirect(target);
    res.cookies.set(USER_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  // ---- Anywhere else -----------------------------------------------
  // Drop this host's cookie on the way past, then go and drop the identity.
  const onward = new URL("/api/auth/logout", authoriseOrigin());
  onward.searchParams.set("to", origin);
  onward.searchParams.set("returnTo", returnTo);

  const res = NextResponse.redirect(onward);
  res.cookies.set(USER_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

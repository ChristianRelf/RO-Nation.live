import { NextRequest, NextResponse } from "next/server";
import { robloxConfigured } from "@/lib/env";
import { requestOrigin } from "@/lib/origin";
import { authorizeUrlFor, isAuthoriseOrigin } from "@/lib/sso";
import {
  buildAuthorizeUrl,
  failPath,
  pkceChallenge,
  randomString,
  redirectUriFor,
} from "@/lib/roblox";

export const dynamic = "force-dynamic";

function sanitizeReturn(v: string | null) {
  if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  return "/tickets";
}

// "Sign in with Roblox" - the link every login page in the app still points at.
//
// It used to run the OAuth round trip on whatever host it was called on, which is
// why every host needed its own registered redirect_uri. Now it does that on ONE
// host and forwards from all the others, so the existing links did not have to
// change and old bookmarks still work.

export async function GET(req: NextRequest) {
  const origin = requestOrigin(req);
  const returnTo = sanitizeReturn(req.nextUrl.searchParams.get("returnTo"));

  // ---- Anywhere but the front door ---------------------------------
  // Hand off to authorise.ronation.live. If they are already signed in there this
  // costs two redirects and no clicks; if not, that host runs the Roblox flow and
  // sends them back with a ticket. See lib/sso.ts.
  if (!isAuthoriseOrigin(origin)) {
    return NextResponse.redirect(authorizeUrlFor(origin, returnTo));
  }

  // ---- The front door ----------------------------------------------
  // The only Roblox round trip in the system. The only redirect_uri Roblox has
  // ever been told about.
  if (!robloxConfigured) {
    const url = new URL(failPath(returnTo), origin);
    url.searchParams.set("error", "not-configured");
    return NextResponse.redirect(url);
  }

  const state = randomString(24);
  const verifier = randomString(48);
  const challenge = await pkceChallenge(verifier);

  const res = NextResponse.redirect(
    buildAuthorizeUrl({
      state,
      challenge,
      redirectUri: redirectUriFor(origin),
    }),
  );

  const opts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  };
  res.cookies.set("ron_oauth_state", state, opts);
  res.cookies.set("ron_oauth_verifier", verifier, opts);
  res.cookies.set("ron_oauth_return", returnTo, opts);
  return res;
}

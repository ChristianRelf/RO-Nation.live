import { NextRequest, NextResponse } from "next/server";
import { robloxConfigured } from "@/lib/env";
import { requestOrigin } from "@/lib/origin";
import { authoriseOrigin, isAuthoriseOrigin, isKnownOrigin } from "@/lib/sso";
import {
  INVENTORY_SCOPES,
  buildAuthorizeUrl,
  failPath,
  pkceChallenge,
  randomString,
  redirectUriFor,
} from "@/lib/roblox";

export const dynamic = "force-dynamic";

// INCREMENTAL CONSENT. "May we check that you bought the ticket?"
//
// Sign-in asks Roblox for `openid profile` and nothing else, and lib/roblox.ts defends that
// line at length: somebody who only ever takes a free ticket must never be shown a prompt
// asking to read their inventory. So the inventory scope is asked for HERE - later, once,
// and only from the one place where the question answers itself: a buyer standing at a paid
// game-pass checkout.
//
// ---- It FORCES the Roblox round trip, and that is the whole point ----------
//
// The SSO front door (api/auth/sso/authorize) short-circuits when you already have a session
// on authorise.ronation.live - two invisible redirects, no clicking. That is exactly right
// for signing in and exactly WRONG for this:
//
//     A SESSION PROVES WHO THEY ARE. IT DOES NOT PROVE WHAT THEY CONSENTED TO.
//
// A signed-in buyer who has never granted the inventory scope has a perfectly valid session
// and no grant. Reuse the short-circuit and they would be bounced straight home with nothing
// asked and nothing stored, the checkout would find no grant, and the button would appear to
// do nothing at all - forever, in a loop, with no error anywhere. So this route never looks
// at the session. It always goes to Roblox.
//
// ---- The route it takes ----------------------------------------------------
//
// Roblox knows exactly ONE redirect_uri - authorise.ronation.live's - so every host has to
// borrow it (see lib/sso.ts). This is the same two-step the login route uses:
//
//   1. anywhere else       → 302 to authorise.../consent?to=<this origin>&returnTo=<path>
//   2. on the front door   → the real PKCE dance, with INVENTORY_SCOPES, and a `return`
//                            cookie pointing at /api/auth/sso/authorize - so that once the
//                            callback has stored the grant, the front door mints a ticket
//                            and lands the buyer back on the host they started from.
//
// The GRANT itself needs no ticket and no cookie to travel: saveGrant() writes it to the
// USER ROW, and every host reads it back from the database by user id. That is why this
// works across origins with no new secret anywhere.

function sanitizeReturn(v: string | null) {
  if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  return "/tickets";
}

export async function GET(req: NextRequest) {
  const origin = requestOrigin(req);
  const returnTo = sanitizeReturn(req.nextUrl.searchParams.get("returnTo"));

  // ---- Anywhere but the front door ---------------------------------
  if (!isAuthoriseOrigin(origin)) {
    const url = new URL("/api/auth/roblox/consent", authoriseOrigin());
    url.searchParams.set("to", origin);
    url.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(url);
  }

  // ---- The front door ----------------------------------------------
  const to = req.nextUrl.searchParams.get("to") ?? origin;

  // THE check, and it is the same one sso/authorize makes for the same reason: `to` decides
  // which host a browser is sent back to with a freshly minted session ticket. An
  // unvalidated one turns this into an oracle that posts RNL sessions to whatever origin
  // somebody names in a link.
  if (!isKnownOrigin(to)) {
    return NextResponse.redirect(new URL("/?error=origin", origin));
  }

  if (!robloxConfigured) {
    const url = new URL(failPath(returnTo), origin);
    url.searchParams.set("error", "not-configured");
    return NextResponse.redirect(url);
  }

  // Where the callback lands once it has stored the grant. For any other host that is the
  // SSO front door, which mints a ticket for `to` and bounces the browser home with a
  // session; when the buyer was already on the front door there is nothing to hand off.
  const afterCallback = isAuthoriseOrigin(to)
    ? returnTo
    : `/api/auth/sso/authorize?to=${encodeURIComponent(to)}&returnTo=${encodeURIComponent(returnTo)}`;

  const state = randomString(24);
  const verifier = randomString(48);
  const challenge = await pkceChallenge(verifier);

  const res = NextResponse.redirect(
    buildAuthorizeUrl({
      state,
      challenge,
      redirectUri: redirectUriFor(origin),
      // The only place in the application that asks for more than `openid profile`.
      scopes: INVENTORY_SCOPES,
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
  res.cookies.set("ron_oauth_return", afterCallback, opts);

  // The flag the callback reads to know this was a CONSENT trip and not a sign-in - which
  // is what tells it to call saveGrant() with the refresh token it just got. Without it the
  // callback would do what it has always done (mint a session, drop the tokens on the
  // floor), and the grant would be thrown away microseconds after being granted.
  res.cookies.set("ron_oauth_grant", "1", opts);

  return res;
}

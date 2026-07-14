import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requestOrigin } from "@/lib/origin";
import { exchangeCode, failPath, fetchUserInfo, redirectUriFor } from "@/lib/roblox";
import { saveGrant } from "@/lib/roblox-tokens";
import {
  USER_COOKIE,
  cookieOptions,
  createUserToken,
} from "@/lib/session";

export const dynamic = "force-dynamic";

function sanitizeReturn(v?: string) {
  if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  return "/tickets";
}

export async function GET(req: NextRequest) {
  // Same host the sign-in began on - see the login route.
  const origin = requestOrigin(req);
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const oauthError = params.get("error");

  const savedState = req.cookies.get("ron_oauth_state")?.value;
  const verifier = req.cookies.get("ron_oauth_verifier")?.value;
  const returnTo = sanitizeReturn(req.cookies.get("ron_oauth_return")?.value);

  // Was this a CONSENT trip (api/auth/roblox/consent) rather than an ordinary sign-in?
  //
  // Read from a cookie WE set, never from the query string - the same discipline as the
  // state and the verifier beside it. A query flag would let anybody append `?grant=1` to a
  // callback URL, and while that could not fabricate a grant (Roblox only returns the scopes
  // it actually issued), it is a decision about what to persist, and decisions about what to
  // persist do not come from the address bar.
  const wantsGrant = req.cookies.get("ron_oauth_grant")?.value === "1";

  const fail = (reason: string) => {
    // Built with URL + searchParams rather than string-concatenating "?error=":
    // failPath() may already carry a query of its own (the front-door case), and
    // "/?to=x?error=y" is not a URL.
    const url = new URL(failPath(returnTo), origin);
    url.searchParams.set("error", reason);

    const res = NextResponse.redirect(url);
    clearOauthCookies(res);
    return res;
  };

  if (oauthError) return fail("denied");
  if (!code || !state || !savedState || state !== savedState || !verifier) {
    return fail("state");
  }

  try {
    const tokens = await exchangeCode(code, verifier, redirectUriFor(origin));
    const info = await fetchUserInfo(tokens.access_token);

    const username =
      info.preferred_username || info.nickname || info.name || `user_${info.sub}`;
    const displayName = info.name || info.nickname || username;

    const user = await prisma.user.upsert({
      where: { robloxId: info.sub },
      update: {
        username,
        displayName,
        avatarUrl: info.picture ?? null,
        profileUrl: info.profile ?? null,
      },
      create: {
        robloxId: info.sub,
        username,
        displayName,
        avatarUrl: info.picture ?? null,
        profileUrl: info.profile ?? null,
      },
    });

    // The inventory grant, if this was a consent trip.
    //
    // saveGrant() stores it on the USER ROW, which is what lets the grant cross hosts with
    // no cookie and no ticket: a partner's checkout reads it straight back out of the
    // database by user id. It also refuses to store a grant with no refresh token - see
    // its own note - because `offline_access` not coming back means the access token dies
    // in fifteen minutes, and recording that as a grant would make hasInventoryGrant()
    // start lying within the hour.
    if (wantsGrant) {
      await saveGrant(user.id, tokens);
    }

    const token = await createUserToken({
      uid: user.id,
      robloxId: user.robloxId,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? undefined,
    });

    const res = NextResponse.redirect(new URL(returnTo, origin));
    res.cookies.set(USER_COOKIE, token, cookieOptions(60 * 60 * 24 * 30));
    clearOauthCookies(res);
    return res;
  } catch (err) {
    console.error("[roblox callback]", err);
    return fail("exchange");
  }
}

function clearOauthCookies(res: NextResponse) {
  for (const name of [
    "ron_oauth_state",
    "ron_oauth_verifier",
    "ron_oauth_return",
    "ron_oauth_grant",
  ]) {
    res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
}

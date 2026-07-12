import { NextRequest, NextResponse } from "next/server";
import { portalRole } from "@/lib/env";
import { exchangeCode, fetchDiscordUser, portalOrigin, redirectUri } from "@/lib/discord";
import { PORTAL_COOKIE, createPortalToken, portalCookieOptions } from "@/lib/session";

export const dynamic = "force-dynamic";

function sanitizeReturn(v?: string) {
  if (v && v.startsWith("/shasha")) return v;
  return "/shasha";
}

export async function GET(req: NextRequest) {
  const origin = portalOrigin(req);
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const oauthError = params.get("error");

  const savedState = req.cookies.get("ron_discord_state")?.value;
  const returnTo = sanitizeReturn(req.cookies.get("ron_discord_return")?.value);

  const fail = (reason: string) => {
    const res = NextResponse.redirect(
      new URL(`/shasha/login?error=${reason}`, origin),
    );
    clearOauthCookies(res);
    return res;
  };

  if (oauthError) return fail("denied");
  if (!code || !state || !savedState || state !== savedState) {
    return fail("state");
  }

  try {
    const tokens = await exchangeCode(code, redirectUri(req));
    const profile = await fetchDiscordUser(tokens.access_token);

    // Access is allowlist-only: a valid Discord login is not enough.
    if (!portalRole(profile.id)) return fail("unauthorised");

    const token = await createPortalToken({
      did: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    });

    const res = NextResponse.redirect(new URL(returnTo, origin));
    res.cookies.set(PORTAL_COOKIE, token, portalCookieOptions());
    clearOauthCookies(res);
    return res;
  } catch (err) {
    console.error("[discord callback]", err);
    return fail("exchange");
  }
}

function clearOauthCookies(res: NextResponse) {
  for (const name of ["ron_discord_state", "ron_discord_return"]) {
    res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
}

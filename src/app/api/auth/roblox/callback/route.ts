import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requestOrigin } from "@/lib/origin";
import { exchangeCode, fetchUserInfo, redirectUriFor } from "@/lib/roblox";
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
  // Same host the sign-in began on — see the login route.
  const origin = requestOrigin(req);
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const oauthError = params.get("error");

  const savedState = req.cookies.get("ron_oauth_state")?.value;
  const verifier = req.cookies.get("ron_oauth_verifier")?.value;
  const returnTo = sanitizeReturn(req.cookies.get("ron_oauth_return")?.value);

  const fail = (reason: string) => {
    const res = NextResponse.redirect(
      new URL(`/account?error=${reason}`, origin),
    );
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
  ]) {
    res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
}

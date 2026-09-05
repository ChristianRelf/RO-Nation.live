import { NextRequest, NextResponse } from "next/server";
import { discordOAuthConfigured } from "@/lib/env";
import { requestOrigin } from "@/lib/origin";
import { getUserSession } from "@/lib/session";
import { buildAuthorizeUrl, randomString, redirectUriFor } from "@/lib/discord-oauth";

export const dynamic = "force-dynamic";

function sanitizeReturn(v: string | null) {
  if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  return "/account";
}

/**
 * "Connect Discord". A DiscordLink always hangs off an existing User row (see
 * prisma schema), so this is only reachable signed in - not signed in, it hands
 * off to Roblox sign-in and chains straight back here, the same way a career
 * apply form sends someone through both in one click.
 */
export async function GET(req: NextRequest) {
  const origin = requestOrigin(req);
  const returnTo = sanitizeReturn(req.nextUrl.searchParams.get("returnTo"));

  const session = await getUserSession();
  if (!session) {
    const url = new URL("/api/auth/roblox/login", origin);
    url.searchParams.set(
      "returnTo",
      `/api/auth/discord/login?returnTo=${encodeURIComponent(returnTo)}`,
    );
    return NextResponse.redirect(url);
  }

  if (!discordOAuthConfigured) {
    const url = new URL(returnTo, origin);
    url.searchParams.set("error", "discord-not-configured");
    return NextResponse.redirect(url);
  }

  const state = randomString(24);

  const res = NextResponse.redirect(
    buildAuthorizeUrl({ state, redirectUri: redirectUriFor(origin) }),
  );

  const opts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  };
  res.cookies.set("ron_discord_oauth_state", state, opts);
  res.cookies.set("ron_discord_oauth_return", returnTo, opts);
  return res;
}

import { NextRequest, NextResponse } from "next/server";
import { discordConfigured } from "@/lib/env";
import {
  buildAuthorizeUrl,
  portalOrigin,
  randomString,
  redirectUri,
} from "@/lib/discord";

export const dynamic = "force-dynamic";

function sanitizeReturn(v: string | null) {
  if (v && v.startsWith("/shasha")) return v;
  return "/shasha";
}

export async function GET(req: NextRequest) {
  const origin = portalOrigin(req);
  const returnTo = sanitizeReturn(req.nextUrl.searchParams.get("returnTo"));

  if (!discordConfigured) {
    return NextResponse.redirect(
      new URL("/shasha/login?error=not-configured", origin),
    );
  }

  const state = randomString(24);
  const res = NextResponse.redirect(
    buildAuthorizeUrl({ state, redirectUri: redirectUri(req) }),
  );

  const opts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  };
  res.cookies.set("ron_discord_state", state, opts);
  res.cookies.set("ron_discord_return", returnTo, opts);
  return res;
}

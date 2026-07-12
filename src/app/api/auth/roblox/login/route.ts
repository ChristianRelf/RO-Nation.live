import { NextRequest, NextResponse } from "next/server";
import { env, robloxConfigured } from "@/lib/env";
import { buildAuthorizeUrl, pkceChallenge, randomString } from "@/lib/roblox";

export const dynamic = "force-dynamic";

function sanitizeReturn(v: string | null) {
  if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  return "/tickets";
}

export async function GET(req: NextRequest) {
  const returnTo = sanitizeReturn(req.nextUrl.searchParams.get("returnTo"));

  if (!robloxConfigured) {
    return NextResponse.redirect(
      new URL("/account?error=not-configured", env.siteUrl),
    );
  }

  const state = randomString(24);
  const verifier = randomString(48);
  const challenge = await pkceChallenge(verifier);

  const res = NextResponse.redirect(buildAuthorizeUrl({ state, challenge }));
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

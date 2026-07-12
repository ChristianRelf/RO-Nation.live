import { NextRequest, NextResponse } from "next/server";
import { robloxConfigured } from "@/lib/env";
import { requestOrigin } from "@/lib/origin";
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

export async function GET(req: NextRequest) {
  // Stay on the host the user started from: the session cookie we're about to
  // set is scoped to it, so a sign-in begun on survey.ronation.live has to come
  // back to survey.ronation.live. Each host used this way needs its callback URL
  // registered in the Roblox OAuth app — including portal.ronation.live.
  const origin = requestOrigin(req);
  const returnTo = sanitizeReturn(req.nextUrl.searchParams.get("returnTo"));

  if (!robloxConfigured) {
    return NextResponse.redirect(
      new URL(`${failPath(returnTo)}?error=not-configured`, origin),
    );
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

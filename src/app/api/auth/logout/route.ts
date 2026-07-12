import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE } from "@/lib/session";
import { requestOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

function sanitizeReturn(v: string | null) {
  if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  return "/";
}

export async function GET(req: NextRequest) {
  // Sign out on the host you signed in on. The session cookie is scoped to that
  // host, so redirecting to a hardcoded siteUrl would march a portal user over
  // to the main site on their way out — and `returnTo` is what lets SHASHA land
  // them back on its own sign-in page rather than RNL's home page.
  const origin = requestOrigin(req);
  const returnTo = sanitizeReturn(req.nextUrl.searchParams.get("returnTo"));

  const res = NextResponse.redirect(new URL(returnTo, origin));
  res.cookies.set(USER_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

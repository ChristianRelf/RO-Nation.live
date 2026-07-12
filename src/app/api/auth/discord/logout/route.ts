import { NextRequest, NextResponse } from "next/server";
import { portalOrigin } from "@/lib/discord";
import { PORTAL_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(
    new URL("/shasha/login", portalOrigin(req)),
  );
  res.cookies.set(PORTAL_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

import { NextResponse } from "next/server";
import { USER_COOKIE } from "@/lib/session";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const res = NextResponse.redirect(new URL("/", env.siteUrl));
  res.cookies.set(USER_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

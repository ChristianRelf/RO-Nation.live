import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { devLoginEnabled, env } from "@/lib/env";
import {
  USER_COOKIE,
  cookieOptions,
  createUserToken,
} from "@/lib/session";

export const dynamic = "force-dynamic";

function sanitizeReturn(v: string) {
  if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  return "/tickets";
}

// Local-only mock login so ticketing can be demoed without real Roblox creds.
export async function POST(req: NextRequest) {
  if (!devLoginEnabled) {
    return NextResponse.redirect(
      new URL("/account?error=disabled", env.siteUrl),
      303,
    );
  }

  const form = await req.formData();
  const raw = String(form.get("username") || "").trim();
  const username =
    raw.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) || "TestFan";
  const returnTo = sanitizeReturn(String(form.get("returnTo") || ""));
  const robloxId = `dev-${username.toLowerCase()}`;

  const user = await prisma.user.upsert({
    where: { robloxId },
    update: { username, displayName: username },
    create: { robloxId, username, displayName: username },
  });

  const token = await createUserToken({
    uid: user.id,
    robloxId: user.robloxId,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: undefined,
  });

  const res = NextResponse.redirect(new URL(returnTo, env.siteUrl), 303);
  res.cookies.set(USER_COOKIE, token, cookieOptions(60 * 60 * 24 * 30));
  return res;
}

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
  // Belt-and-braces with the env gate below. This route mints a full member
  // session for an arbitrary username with NO credential, so it must never be
  // reachable from a production build - not even one mis-deployed with
  // ALLOW_DEV_LOGIN=true and Roblox creds still unprovisioned (the exact state
  // that would otherwise slip past the `devLoginEnabled` gate). instrumentation.ts
  // now also refuses to boot prod when ALLOW_DEV_LOGIN is set; this is the second lock.
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

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

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requestOrigin } from "@/lib/origin";
import { getUserSession } from "@/lib/session";
import { exchangeCode, fetchUserInfo, redirectUriFor } from "@/lib/discord-oauth";

export const dynamic = "force-dynamic";

function sanitizeReturn(v?: string) {
  if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  return "/account";
}

export async function GET(req: NextRequest) {
  const origin = requestOrigin(req);
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const oauthError = params.get("error");

  const savedState = req.cookies.get("ron_discord_oauth_state")?.value;
  const returnTo = sanitizeReturn(req.cookies.get("ron_discord_oauth_return")?.value);

  const fail = (reason: string) => {
    const url = new URL(returnTo, origin);
    url.searchParams.set("error", reason);
    const res = NextResponse.redirect(url);
    clearOauthCookies(res);
    return res;
  };

  if (oauthError) return fail("discord-denied");
  if (!code || !state || !savedState || state !== savedState) {
    return fail("discord-state");
  }

  // The session that started this. If it is gone (cookie expired mid-flow, or
  // they signed out in another tab) there is nobody to attach a Discord id to -
  // refuse rather than guess.
  const session = await getUserSession();
  if (!session) return fail("discord-signin");

  try {
    const tokens = await exchangeCode(code, redirectUriFor(origin));
    const info = await fetchUserInfo(tokens.access_token);

    // One Discord account per Roblox account and vice versa - the same rule the
    // bot-redeemed link enforces (lib/discord-link.ts). Refuse rather than move a
    // Discord id off the account that already holds it; its owner unlinks first.
    const existing = await prisma.discordLink.findUnique({
      where: { discordId: info.id },
      select: { userId: true },
    });
    if (existing && existing.userId !== session.uid) {
      return fail("discord-taken");
    }

    await prisma.discordLink.upsert({
      where: { userId: session.uid },
      create: {
        userId: session.uid,
        discordId: info.id,
        discordUsername: info.global_name || info.username,
      },
      update: {
        discordId: info.id,
        discordUsername: info.global_name || info.username,
      },
    });

    const res = NextResponse.redirect(new URL(returnTo, origin));
    clearOauthCookies(res);
    return res;
  } catch (err) {
    console.error("[discord callback]", err);
    return fail("discord-exchange");
  }
}

function clearOauthCookies(res: NextResponse) {
  for (const name of ["ron_discord_oauth_state", "ron_discord_oauth_return"]) {
    res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
}

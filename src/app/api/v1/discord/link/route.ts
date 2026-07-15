import { NextRequest, NextResponse } from "next/server";
import { authorize, badRequest, readJson, str } from "@/lib/api/guard";
import { rateLimit } from "@/lib/rate-limit";
import { findDiscordLink, redeemLinkCode } from "@/lib/discord-link";

export const dynamic = "force-dynamic";

// The Discord bot's endpoint. Auth is the ordinary /api/v1 key, with the DISCORD_LINK
// scope and nothing else - it touches no tickets and no money.
//
//   POST /api/v1/discord/link
//     { "code": "123456", "discordId": "…", "discordUsername": "…"? }
//     Redeem the rotating code shown at ronation.live/account/link and tie that Roblox
//     account to the Discord id.
//
//   GET  /api/v1/discord/link?discordId=…   (or ?robloxId=…)
//     Who is linked - for role sync, a "/whois", a leaderboard that wants real names.
//
// `discordId` MUST be the id Discord reports for whoever invoked the command, never a
// value the user typed - the whole link is only as trustworthy as that binding.

const MESSAGES: Record<"invalid" | "discord_taken", string> = {
  invalid:
    "That code is wrong or has expired. Get a fresh one at ronation.live/account/link.",
  discord_taken:
    "That Discord account is already linked to a different Roblox account - unlink it first.",
};

export async function POST(req: NextRequest) {
  const auth = await authorize(req, "DISCORD_LINK");
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(req);
  const code = str(body.code);
  const discordId = str(body.discordId);
  if (!code || !discordId) return badRequest("provide `code` and `discordId`");

  // The guessing guard, and the reason a six-digit code is safe. Keyed on the DISCORD
  // id the bot forwards - the person actually guessing - so a few tries is all anyone
  // gets against a code that is valid for two minutes, and one impatient user cannot
  // burn the whole bot's budget and lock everybody else out. The per-key ceiling in
  // authorize() sits on top of this.
  const rl = await rateLimit(`discordlink:${discordId}`, {
    limit: 8,
    windowSeconds: 600,
  });
  if (!rl.ok) {
    const res = NextResponse.json(
      {
        ok: false,
        error: "rate_limited",
        hint: "Too many link attempts for this Discord account. Wait a few minutes, then try a fresh code.",
      },
      { status: 429 },
    );
    res.headers.set(
      "Retry-After",
      String(Math.max(1, Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000))),
    );
    return res;
  }

  const result = await redeemLinkCode({
    code,
    discordId,
    discordUsername: str(body.discordUsername),
  });

  // A wrong or spoken-for code is a 200 with linked:false, not an HTTP error - the
  // request was understood, the answer is just no. Same shape as the ticket API.
  if (!result.ok) {
    return NextResponse.json({
      ok: true,
      linked: false,
      reason: result.reason,
      message: MESSAGES[result.reason],
    });
  }

  return NextResponse.json({
    ok: true,
    linked: true,
    robloxId: result.robloxId,
    username: result.username,
    displayName: result.displayName,
  });
}

export async function GET(req: NextRequest) {
  const auth = await authorize(req, "DISCORD_LINK");
  if (auth instanceof NextResponse) return auth;

  const params = new URL(req.url).searchParams;
  const discordId = str(params.get("discordId"));
  const robloxId = str(params.get("robloxId"));
  if (!discordId && !robloxId) {
    return badRequest("provide `discordId` or `robloxId`");
  }

  const link = await findDiscordLink({ discordId, robloxId });
  if (!link) return NextResponse.json({ ok: true, linked: false });

  return NextResponse.json({
    ok: true,
    linked: true,
    robloxId: link.robloxId,
    username: link.username,
    displayName: link.displayName,
    discordId: link.discordId,
    discordUsername: link.discordUsername,
    linkedAt: link.linkedAt,
  });
}

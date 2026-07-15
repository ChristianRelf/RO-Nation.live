import { NextRequest, NextResponse } from "next/server";
import { authorize, badRequest, readJson, str } from "@/lib/api/guard";
import { removeDiscordLink } from "@/lib/discord-link";

export const dynamic = "force-dynamic";

// POST /api/v1/discord/unlink   scope: DISCORD_LINK
//   { "discordId": "…" }   or   { "robloxId": "…" }
//
// Drop a link - for a "/unlink" command, or for the bot to clean up when somebody
// leaves the server. Idempotent: unlinking something that was not linked is a success
// with unlinked:false, not an error. (A member can also unlink themselves from
// ronation.live/account/link.)

export async function POST(req: NextRequest) {
  const auth = await authorize(req, "DISCORD_LINK");
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(req);
  const discordId = str(body.discordId);
  const robloxId = str(body.robloxId);
  if (!discordId && !robloxId) {
    return badRequest("provide `discordId` or `robloxId`");
  }

  const unlinked = await removeDiscordLink({ discordId, robloxId });
  return NextResponse.json({ ok: true, unlinked });
}

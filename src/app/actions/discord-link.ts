"use server";

import { getUserSession } from "@/lib/session";
import { rotateLinkCode, removeDiscordLink } from "@/lib/discord-link";

// The two things the /account/link page does from the browser: roll a fresh code,
// and unlink. Both re-read the session server-side and act ONLY on the caller's own
// account - the client never names whose code or whose link, so there is nothing for
// it to point at somebody else.

export type RefreshResult = { code: string; expiresAt: number } | null;

/** Rotate the signed-in member's code. null if the session has gone (re-login). */
export async function refreshLinkCode(): Promise<RefreshResult> {
  const session = await getUserSession();
  if (!session) return null;
  const { code, expiresAt } = await rotateLinkCode(session.uid);
  return { code, expiresAt: expiresAt.getTime() };
}

/** Drop the signed-in member's Discord link. Idempotent - fine if there wasn't one. */
export async function unlinkDiscord(): Promise<{ ok: boolean }> {
  const session = await getUserSession();
  if (!session) return { ok: false };
  await removeDiscordLink({ userId: session.uid });
  return { ok: true };
}

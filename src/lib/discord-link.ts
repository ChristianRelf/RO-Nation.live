import "server-only";
import { randomInt } from "crypto";
import type { DiscordLink } from "@prisma/client";
import { prisma } from "./db";

// Linking a Roblox account to a Discord one, by a short rotating code.
//
// The flow, and where the safety is:
//
//   1. A signed-in member opens /account/link. rotateLinkCode() mints them a fresh
//      six-digit code (LinkCode), replacing any previous one, valid for TTL seconds.
//   2. They read it to a Discord bot. The bot calls POST /api/v1/discord/link with
//      the code and the Discord user id, holding a key with the DISCORD_LINK scope.
//   3. redeemLinkCode() finds the code, burns it, and writes the DiscordLink.
//
// Six digits is ~20 bits - guessable on its own. It is safe only because of the wall
// around it, and every piece of that wall matters:
//
//   • the redeem endpoint is KEY-GATED (only the bot can call it) and RATE-LIMITED
//     per Discord id, so guessing costs a bot key and buys a handful of tries;
//   • a code is SINGLE-USE and ONE-PER-ACCOUNT (rotating replaces it), so there is at
//     most one live code per member and it dies the instant it is spent;
//   • it EXPIRES in 20 seconds, so any given target is valid only for a blink;
//   • a wrong guess returns one uniform answer, so the endpoint is not an oracle.
//
// Remove any one of those and six digits becomes too few. Keep them and the whole
// space an attacker can search in a code's lifetime, through a rate-limited key, is
// nothing.

/** How long a freshly-minted code lives - deliberately tight. Just long enough to
 *  read the six digits into Discord, and short enough that a guessed code is almost
 *  never still valid by the time it is tried. The page rotates on this. */
export const LINK_CODE_TTL_SECONDS = 20;

/** Unbiased six-digit code, zero-padded. crypto.randomInt, never Math.random - a
 *  predictable code is a guessable one, and the whole point is that it is not. */
function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** "123 . 456" - the shape the page shows. Grouping only; the code is the six digits. */
export function formatLinkCode(code: string): string {
  const digits = code.replace(/\D/g, "").padStart(6, "0").slice(-6);
  return `${digits.slice(0, 3)} . ${digits.slice(3)}`;
}

/** The six digits back out of anything the bot might forward ("123 . 456", "123-456"). */
export function normaliseCode(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  return digits.length === 6 ? digits : null;
}

export type LinkCodeView = { code: string; expiresAt: Date };

/**
 * Mint (or rotate) this account's live code. Upserts on userId, so a member never
 * holds two valid codes - the old one is overwritten and instantly dead.
 *
 * `code` is globally unique, so a freshly-rolled one can collide with another
 * member's live code; that is a unique-constraint violation, and the answer is
 * simply to roll again. A few tries is astronomically enough in a 1,000,000 space
 * with a handful of codes ever live at once.
 */
export async function rotateLinkCode(userId: string): Promise<LinkCodeView> {
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_SECONDS * 1000);

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateCode();
    try {
      await prisma.linkCode.upsert({
        where: { userId },
        create: { userId, code, expiresAt },
        update: { code, expiresAt },
      });
      return { code, expiresAt };
    } catch (err) {
      // P2002 = the code collided with a live one. Roll again. Anything else is real.
      if (isUniqueViolation(err) && attempt < 5) continue;
      throw err;
    }
  }
  // Unreachable in practice - six collisions in a row is a lottery win - but a
  // function that can loop must have a floor.
  throw new Error("could not allocate a unique link code");
}

export type RedeemResult =
  | { ok: true; robloxId: string; username: string; displayName: string }
  | { ok: false; reason: "invalid" | "discord_taken" };

/**
 * The bot's side. Turn a code + a Discord id into a link, or say why not.
 *
 *   invalid        No live code matches. Covers "never existed", "already spent" and
 *                  "expired" with ONE answer on purpose - distinguishing them tells a
 *                  guesser which of their tries grazed a real code.
 *   discord_taken  That Discord account is already linked to a DIFFERENT Roblox
 *                  account. Refused rather than moved: a guessed code must not let
 *                  somebody yank a Discord off the account that really owns it. The
 *                  holder unlinks first (their own /account/link, or the bot).
 *
 * The `discordId` MUST come from the Discord interaction itself, never from text the
 * user typed - the bot is trusting us to bind a code to a person, and the person is
 * whoever Discord says invoked the command.
 */
export async function redeemLinkCode(input: {
  code: string;
  discordId: string;
  discordUsername?: string | null;
}): Promise<RedeemResult> {
  const code = normaliseCode(input.code);
  const discordId = input.discordId.trim();
  if (!code || !discordId) return { ok: false, reason: "invalid" };

  return prisma.$transaction(async (tx) => {
    // Live means: matches, and not past expiry. An expired row is treated as absent
    // (and swept later by the cull); it is never honoured.
    const row = await tx.linkCode.findFirst({
      where: { code, expiresAt: { gt: new Date() } },
      select: { userId: true, user: { select: { robloxId: true, username: true, displayName: true } } },
    });
    if (!row) return { ok: false, reason: "invalid" } as const;

    // This Discord already spoken for by someone else? Refuse - see above.
    const existing = await tx.discordLink.findUnique({
      where: { discordId },
      select: { userId: true },
    });
    if (existing && existing.userId !== row.userId) {
      // Burn the code anyway: it did its job of proving this member, and leaving it
      // live would just be a second chance at the same refusal.
      await tx.linkCode.deleteMany({ where: { userId: row.userId } });
      return { ok: false, reason: "discord_taken" } as const;
    }

    // Write the link (idempotent per account - re-linking moves this member onto a
    // new Discord) and burn the code.
    await tx.discordLink.upsert({
      where: { userId: row.userId },
      create: { userId: row.userId, discordId, discordUsername: input.discordUsername ?? null },
      update: { discordId, discordUsername: input.discordUsername ?? null },
    });
    await tx.linkCode.deleteMany({ where: { userId: row.userId } });

    return {
      ok: true,
      robloxId: row.user.robloxId,
      username: row.user.username,
      displayName: row.user.displayName,
    } as const;
  });
}

/** The link for a signed-in member's own account page. */
export function getDiscordLinkByUser(userId: string): Promise<DiscordLink | null> {
  return prisma.discordLink.findUnique({ where: { userId } });
}

/** Bot lookups: "who is this Discord user / this Roblox player?" */
export async function findDiscordLink(by: {
  discordId?: string | null;
  robloxId?: string | null;
}): Promise<
  | { robloxId: string; username: string; displayName: string; discordId: string; discordUsername: string | null; linkedAt: Date }
  | null
> {
  const where = by.discordId
    ? { discordId: by.discordId }
    : by.robloxId
      ? { user: { robloxId: by.robloxId } }
      : null;
  if (!where) return null;

  const link = await prisma.discordLink.findFirst({
    where,
    select: {
      discordId: true,
      discordUsername: true,
      linkedAt: true,
      user: { select: { robloxId: true, username: true, displayName: true } },
    },
  });
  if (!link) return null;
  return {
    robloxId: link.user.robloxId,
    username: link.user.username,
    displayName: link.user.displayName,
    discordId: link.discordId,
    discordUsername: link.discordUsername,
    linkedAt: link.linkedAt,
  };
}

/** Remove a link. Returns whether one was actually there to remove. */
export async function removeDiscordLink(by: {
  userId?: string | null;
  discordId?: string | null;
  robloxId?: string | null;
}): Promise<boolean> {
  const where = by.userId
    ? { userId: by.userId }
    : by.discordId
      ? { discordId: by.discordId }
      : by.robloxId
        ? { user: { robloxId: by.robloxId } }
        : null;
  if (!where) return false;

  const { count } = await prisma.discordLink.deleteMany({ where });
  return count > 0;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2002"
  );
}

import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { ApiKeyScope } from "@prisma/client";
import { prisma } from "./db";
import { env } from "./env";
import { partnerBySlug } from "./partners/registry";

// Who is calling /api/v1, and what may they do?
//
// One function answers both - resolveApiKey() - and every route under /api/v1
// goes through it. That is not tidiness, it is the security boundary: a route
// that authenticates itself is a route that will one day forget to.
//
// ---- The two kinds of caller ---------------------------------------------
//
// ROOT is the original GAME_API_KEY env var, and it is deliberately unchanged.
// It is unscoped (`scope: undefined` - every org's events) and holds every
// capability, because that is exactly what it does today and it is sitting in
// RNL's live game servers right now. Narrowing it here would take the door down
// on deploy. It is the one key that is not a row, and it should be retired once
// the game has been moved onto a minted one.
//
// A MINTED key is a row in `api_keys`. It belongs to one org and carries a list
// of scopes. Both are read from the row - never from the request - so a caller
// cannot widen either. There is no parameter to widen them with.
//
// ---- The token ------------------------------------------------------------
//
//   rnl_<keyId>_<secret>        rnl_k7m2p9x4qz_9f3hd2n8...   (47 chars)
//
// `keyId` is public and indexed, so authenticating is one keyed read plus a hash
// compare - not a scan of every hash in the table. `secret` is 160 bits of CSPRNG
// output and is never stored: we keep SHA-256 of the whole token. See the note in
// schema.prisma for why a fast hash is the right one here and bcrypt is not.

/** Crockford-ish base32: no vowels to spell with, no glyphs that get misread. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

const KEY_ID_LENGTH = 10;
const SECRET_LENGTH = 32;
const TOKEN_RE = /^rnl_([a-z2-9]{10})_([a-z2-9]{32})$/;

function randomToken(length: number) {
  // Two bytes per character, then modulo. The naive one-byte version skews the
  // first few letters of the alphabet, because 31 does not divide 256; with 16
  // bits the bias is under one part in 2000, which for a 160-bit secret is
  // nothing at all.
  const bytes = randomBytes(length * 2);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[((bytes[i * 2] << 8) | bytes[i * 2 + 1]) % ALPHABET.length];
  }
  return out;
}

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Compare two digests without leaking where they first differ. */
function digestsMatch(a: Buffer, b: Buffer) {
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The org a key belongs to, and what it may do. */
export type ApiCaller = {
  /** The row's id, or null for the env-var root key. Recorded on writes. */
  id: string | null;
  /** What to call it in an audit line. */
  name: string;
  /**
   * The org whose tickets this caller may touch.
   *
   * Exactly the shape LookupInput.scope wants, and that is the point - it is
   * passed straight through:
   *
   *   undefined   don't scope at all. ROOT only.
   *   null        RO. Nation LIVE's own shows.
   *   "<slug>"    that partner's shows, and nothing else.
   */
  scope: string | null | undefined;
  /** True for the env-var key: unscoped, every capability, no row. */
  root: boolean;
  scopes: ReadonlySet<ApiKeyScope>;
};

/** Every capability there is. What ROOT holds, and what the mint form offers. */
export const ALL_SCOPES: readonly ApiKeyScope[] = [
  "EVENTS_READ",
  "TICKETS_VERIFY",
  "TICKETS_REDEEM",
  "TICKETS_ISSUE",
  "TICKETS_PURCHASE",
  "TICKETS_VOID",
];

/** What each scope is called, and what it hands over, in the portal's own words. */
export const SCOPE_LABELS: Record<
  ApiKeyScope,
  { title: string; detail: string }
> = {
  EVENTS_READ: {
    title: "Read events",
    detail: "List your shows, their tiers, capacity and how many seats are left.",
  },
  TICKETS_VERIFY: {
    title: "Verify tickets",
    detail: "Check whether a ticket is real and what tier it is. Changes nothing.",
  },
  TICKETS_REDEEM: {
    title: "Check in at the door",
    detail: "Mark a ticket used. This is the scanner's scope.",
  },
  TICKETS_ISSUE: {
    title: "Issue tickets",
    detail: "Reserve and gift free tickets from inside the experience.",
  },
  TICKETS_PURCHASE: {
    title: "Sell tickets for Robux",
    detail:
      "Issue a paid ticket on the word of your game server. Nothing on our side can check the payment - only give this to a place you trust with your own Robux.",
  },
  TICKETS_VOID: {
    title: "Void and revoke",
    detail: "Take a ticket back, or ban a player from one of your shows.",
  },
};

/** The token as it arrived, or "". Header or bearer - both have always worked. */
function presentedToken(req: Request) {
  return (
    req.headers.get("x-api-key") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    ""
  ).trim();
}

/**
 * Mint a key. Returns the row AND the one and only copy of the token.
 *
 * Show the token to whoever asked for it, once. We keep the hash. If they lose
 * it they mint another - there is no way back, because there is nothing stored to
 * find a way back to. That is the trade every API makes, and it is the right one:
 * a key you can re-read is a key anybody with the database can re-read.
 */
export async function mintApiKey(input: {
  partnerId: string | null;
  name: string;
  scopes: ApiKeyScope[];
  createdById: string;
  createdByName: string;
}) {
  const keyId = randomToken(KEY_ID_LENGTH);
  const secret = randomToken(SECRET_LENGTH);
  const token = `rnl_${keyId}_${secret}`;

  const key = await prisma.apiKey.create({
    data: {
      partnerId: input.partnerId,
      name: input.name,
      keyId,
      hash: digest(token).toString("hex"),
      scopes: input.scopes,
      createdById: input.createdById,
      createdByName: input.createdByName,
    },
  });

  return { key, token };
}

/**
 * Authenticate a request.
 *
 * null means "no", for every reason there is - a missing header, a malformed
 * token, an unknown keyId, a wrong secret, a revoked key, a key belonging to an
 * org that has since been de-listed. The caller gets one answer for all of them
 * on purpose: telling somebody *which* part of their guess was wrong is how a
 * token gets brute-forced one field at a time.
 */
export async function resolveApiKey(req: Request): Promise<ApiCaller | null> {
  const presented = presentedToken(req);
  if (!presented) return null;

  // ---- ROOT: the env-var key ---------------------------------------------
  // Checked first, compared in constant time, and matched as an opaque string -
  // it is not in the token format below and never will be. An old game server
  // holding it keeps working with no redeploy, which is the entire requirement.
  if (env.gameApiKey && digestsMatch(digest(presented), digest(env.gameApiKey))) {
    return {
      id: null,
      name: "GAME_API_KEY (root)",
      // Unscoped - the only caller that is, and the reason this key should not
      // outlive the migration of RNL's own game onto a minted one.
      scope: undefined,
      root: true,
      scopes: new Set(ALL_SCOPES),
    };
  }

  // ---- A minted key --------------------------------------------------------
  const parsed = TOKEN_RE.exec(presented);
  if (!parsed) return null;

  const key = await prisma.apiKey.findUnique({ where: { keyId: parsed[1] } });
  if (!key) return null;
  if (key.revokedAt) return null;

  if (!digestsMatch(digest(presented), Buffer.from(key.hash, "hex"))) return null;

  // A key for a partner who has been de-listed or deactivated in the registry
  // stops working. The registry is the partner table - it says so itself - and a
  // key is only ever as live as the org it belongs to.
  if (key.partnerId && !partnerBySlug(key.partnerId)) return null;

  touch(key.id, key.lastUsedAt);

  return {
    id: key.id,
    name: key.name,
    // The whole point of the table. `partnerId` is null for RNL and a slug for a
    // partner, which is exactly what LookupInput.scope reads - so a minted key is
    // ALWAYS scoped, and there is no code path where it isn't.
    scope: key.partnerId,
    root: false,
    scopes: new Set(key.scopes),
  };
}

/**
 * Record that a key was used - fire-and-forget, and at most once a minute.
 *
 * This is a write on the hot path of every door scan, so it is deliberately not
 * awaited and deliberately not precise. It answers exactly one question, in the
 * portal - "is this key still in use, or can I delete it?" - and a minute of
 * staleness does not change that answer. A failed write must never fail a
 * check-in, which is why the rejection is swallowed.
 */
function touch(id: string, lastUsedAt: Date | null) {
  const MINUTE = 60_000;
  if (lastUsedAt && Date.now() - lastUsedAt.getTime() < MINUTE) return;

  void prisma.apiKey
    .update({ where: { id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
}

export function hasScope(caller: ApiCaller, scope: ApiKeyScope) {
  return caller.scopes.has(scope);
}

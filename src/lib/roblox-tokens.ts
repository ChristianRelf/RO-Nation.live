import "server-only";
import { prisma } from "@/lib/db";
import { refreshTokens, INVENTORY_SCOPES, type RobloxTokens } from "@/lib/roblox";

// The Roblox OAuth grant, kept alive.
//
// One job: hand back an access token that works, for a user who has consented to us
// reading their inventory. Everything else in here exists to survive the two things
// Roblox does that will otherwise break it.
//
// ---- Thing one: refresh tokens ROTATE -------------------------------------
//
// Spending a refresh token invalidates it and returns a NEW one. So a refresh is not
// an update, it is a compare-and-swap, and treating it as an update is a real bug with
// a real victim:
//
//   The game-pass checkout POLLS. Two tabs open on the same order - or one tab and one
//   background revalidation - both read the same expired access token, both spend the
//   same refresh token. Roblox honours the first and rejects the second. If both then
//   blindly write their result, the loser's write (a token Roblox has already thrown
//   away, or nothing at all) lands on top of the winner's, and the grant is DEAD. Not
//   expired - dead. The buyer has to go and re-consent, and nothing on any screen can
//   tell them why.
//
// So the write below is `updateMany` with the OLD refresh token in the WHERE clause. It
// matches one row or zero. Zero means somebody else got there first, and the correct
// response is to take THEIR token, not to fight them for it.
//
// ---- Thing two: an access token lasts fifteen minutes ---------------------
//
// And the checkout polls every two seconds. Refreshing on every poll would be four
// hundred token requests per buyer, which is both absurd and an excellent way to get
// rate-limited on the one endpoint we cannot afford to lose. So: refresh only inside the
// last sixty seconds of the token's life, and hand back the cached one otherwise.

/** Refresh when the token has less than this left. Not on every call. */
const REFRESH_WINDOW_MS = 60_000;

export type GrantResult =
  | { ok: true; accessToken: string }
  /**
   * The three failures, kept apart on purpose - the same discipline as DetailResult in
   * lib/merch/roblox.ts, and for the same reason. Collapsing them into one falsy value
   * is how you end up telling somebody who has just spent 500 Robux that they did not pay.
   *
   *   no_grant     They never consented, or they revoked it. The fix is a BUTTON.
   *   unavailable  Roblox did not answer. The fix is WAITING. Change nothing.
   */
  | { ok: false; reason: "no_grant" | "unavailable" };

/** Has this person granted us the inventory scope at all? Cheap - no network. */
export async function hasInventoryGrant(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { robloxRefreshToken: true, robloxScopes: true },
  });
  if (!user?.robloxRefreshToken) return false;
  return user.robloxScopes.includes("user.inventory-item:read");
}

/**
 * Store a grant, after a consent round trip.
 *
 * `scope` is what Roblox says they ACTUALLY granted, which is not necessarily what we
 * asked for - a person can untick a box on the consent screen. We record what we were
 * given, so hasInventoryGrant() answers honestly rather than assuming.
 */
export async function saveGrant(userId: string, tokens: RobloxTokens) {
  if (!tokens.refresh_token) {
    // No refresh token means `offline_access` was not granted, and the access token dies
    // in fifteen minutes. Storing it would be storing a fact that expires before anybody
    // reads it - and worse, hasInventoryGrant() would start answering "yes" to a grant
    // that is about to stop working. Store nothing; the caller re-consents.
    return;
  }

  const scopes = (tokens.scope ?? INVENTORY_SCOPES.join(" ")).split(/\s+/).filter(Boolean);

  await prisma.user.update({
    where: { id: userId },
    data: {
      robloxAccessToken: tokens.access_token,
      robloxRefreshToken: tokens.refresh_token,
      robloxTokenExpires: new Date(Date.now() + tokens.expires_in * 1000),
      robloxScopes: scopes,
    },
  });
}

/**
 * An access token that works, refreshing it if it is about to stop.
 *
 * This is the function the ownership check hangs off, and it is called on a poll loop, so
 * the fast path - a token with minutes left - must do exactly one indexed read and no
 * network at all.
 */
export async function accessTokenFor(userId: string): Promise<GrantResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      robloxAccessToken: true,
      robloxRefreshToken: true,
      robloxTokenExpires: true,
      robloxScopes: true,
    },
  });

  if (!user?.robloxRefreshToken) return { ok: false, reason: "no_grant" };
  if (!user.robloxScopes.includes("user.inventory-item:read")) {
    return { ok: false, reason: "no_grant" };
  }

  // The fast path, and the one that runs ~99% of the time.
  const expires = user.robloxTokenExpires?.getTime() ?? 0;
  if (user.robloxAccessToken && expires - Date.now() > REFRESH_WINDOW_MS) {
    return { ok: true, accessToken: user.robloxAccessToken };
  }

  const old = user.robloxRefreshToken;
  const next = await refreshTokens(old);

  if (!next?.access_token) {
    // Roblox refused. Two very different reasons, and we cannot tell them apart from
    // here: a 5xx (wait) or a revoked grant (re-consent). We must not guess "revoked" and
    // wipe the tokens - a bad minute at Roblox would then log every buyer out of their own
    // payment. So: report `unavailable`, change NOTHING, and let them try again.
    //
    // A genuinely revoked grant then fails every time, and the checkout's manual retry is
    // what eventually surfaces it. Slower, and right.
    return { ok: false, reason: "unavailable" };
  }

  // ---- The compare-and-swap ------------------------------------------------
  //
  // `robloxRefreshToken: old` in the WHERE clause is the whole point. If another request
  // refreshed while we were in flight, this matches zero rows and writes nothing - rather
  // than overwriting a live token with one Roblox has already retired.
  const { count } = await prisma.user.updateMany({
    where: { id: userId, robloxRefreshToken: old },
    data: {
      robloxAccessToken: next.access_token,
      robloxRefreshToken: next.refresh_token ?? old,
      robloxTokenExpires: new Date(Date.now() + next.expires_in * 1000),
    },
  });

  if (count === 0) {
    // We lost. Somebody else refreshed the same grant a moment ago, and THEIR token is the
    // live one - ours may already have been rotated out from under us. Take theirs.
    const winner = await prisma.user.findUnique({
      where: { id: userId },
      select: { robloxAccessToken: true },
    });
    return winner?.robloxAccessToken
      ? { ok: true, accessToken: winner.robloxAccessToken }
      : { ok: false, reason: "unavailable" };
  }

  return { ok: true, accessToken: next.access_token };
}

import "server-only";
import { prisma } from "@/lib/db";
import { accessTokenFor } from "@/lib/roblox-tokens";

// Did they actually pay?
//
// The one question in this entire system that can be answered without taking somebody's
// word for it - and this is the file that answers it.
//
// Everything else about Robux runs on trust. A Developer Product receipt is witnessed only
// by the game server's ProcessReceipt handler, and Roblox offers no way to check it, so
// /api/v1/tickets/purchase believes whoever holds the key (read the long note on
// TicketPurchase in schema.prisma - it does not hide this).
//
// A GAME PASS is different, and the difference is the reason the whole web checkout is
// built on it:
//
//   1. It is bought on roblox.com, in a browser. No experience to launch, no game server
//      in the loop, works on a phone.
//   2. Afterwards, we can ASK ROBLOX whether they own it - over Open Cloud, authorised by
//      the buyer's OWN OAuth grant (`user.inventory-item:read`).
//
// So a claim on this rail is CHECKED, not believed. There is no key that can assert a
// payment, because there is no assertion: there is a question, and Roblox answers it.
//
// ---- Why the three-state result is not optional --------------------------
//
// `ownsGamePass` cannot return a boolean, and the reason is written in blood one directory
// over. lib/merch/roblox.ts has a long comment about how collapsing "Roblox did not answer"
// into "the answer is no" made the shop silently lose a shirt - a rate-limited fetch looked
// exactly like "this asset is not clothing", and the admin page reported a reason that was
// simply untrue.
//
// Here the same collapse is worse than a missing shirt. "We could not reach Roblox" and
// "they do not own the pass" are the same falsy value and completely different facts, and
// treating the first as the second means telling somebody who has just spent 500 Robux that
// they did not pay. So:
//
//   owns: true    They paid. Issue the ticket.
//   owns: false   Roblox says no. NOT an error - the inventory lags a purchase by seconds,
//                 so this is the normal answer while a buyer is still coming back. Poll.
//   no_grant      They never let us look. The fix is a BUTTON (re-consent), not a spinner.
//   unavailable   We could not ask. The fix is WAITING. Take no money, promise nothing,
//                 and above all do not tell them they did not pay.

const TIMEOUT_MS = 8000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET some JSON, with one retry on the failures that might change.
 *
 * Lifted in shape - not in code - from getJson() in lib/merch/roblox.ts, whose comment
 * explains why the retry is load-bearing rather than defensive habit. Not shared with it
 * because that one is anonymous and this one is bearer-authenticated, and the day somebody
 * "tidies" them into one function is the day an auth header leaks onto a public endpoint.
 */
async function getJson<T>(
  url: string,
  init: RequestInit = {},
  retries = 1,
): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          accept: "application/json",
          "user-agent": "ronation.live ticketing",
          ...(init.headers ?? {}),
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });

      if (res.ok) return { ok: true, data: (await res.json()) as T };

      // A 401/403/404 will not change by asking again - a dead token, a deleted pass. Only
      // back off for the ones that might.
      const worthRetrying = res.status === 429 || res.status >= 500;
      if (!worthRetrying || attempt >= retries) {
        return { ok: false, status: res.status };
      }
    } catch {
      // Timeout, DNS, malformed JSON. Indistinguishable from a 5xx, and treated as one.
      if (attempt >= retries) return { ok: false, status: 0 };
    }

    await sleep(600 * (attempt + 1));
  }
}

// ---- Does this person own that pass? --------------------------------------

export type OwnershipResult =
  | { ok: true; owns: boolean }
  | { ok: false; reason: "no_grant" | "unavailable" };

/**
 * Ask Roblox whether a user owns a game pass.
 *
 * Authorised by THEIR OWN grant, not by an API key of ours, and that is deliberate: Roblox
 * enforces inventory privacy, and a user whose inventory is private is invisible to any
 * key we could hold. Their consent is the only thing that reliably opens the door - and it
 * is also the honest arrangement, because the thing we are looking at is theirs.
 *
 * `filter=gamePassIds=<id>` asks about exactly one pass. We deliberately do not fetch their
 * inventory and search it: it is somebody's private property, we need one bit out of it, and
 * asking for the one bit is both faster and the only version of this that is decent.
 */
export async function ownsGamePass(
  userId: string,
  gamePassId: string,
): Promise<OwnershipResult> {
  const grant = await accessTokenFor(userId);
  if (!grant.ok) return grant;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { robloxId: true },
  });
  if (!user) return { ok: false, reason: "no_grant" };

  const url =
    `https://apis.roblox.com/cloud/v2/users/${user.robloxId}/inventory-items` +
    `?filter=${encodeURIComponent(`gamePassIds=${gamePassId}`)}&maxPageSize=10`;

  const res = await getJson<{
    inventoryItems?: { gamePassDetails?: { gamePassId?: string } }[];
  }>(url, { headers: { authorization: `Bearer ${grant.accessToken}` } });

  if (!res.ok) {
    // A 401 means the token we just refreshed is not good enough - a revoked grant, or a
    // scope they declined. That is a re-consent, and it is a different sentence to the
    // buyer than "Roblox is down", so it must not be folded into `unavailable`.
    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: "no_grant" };
    }
    return { ok: false, reason: "unavailable" };
  }

  // An EMPTY list is a real answer, and it is the answer we get for the first few seconds
  // after every single purchase: Roblox's inventory lags. `owns: false` is therefore NOT a
  // failure and the checkout must not render it as one - it means "not yet", and the only
  // correct response is to poll and say "waiting for Roblox".
  const items = res.data.inventoryItems ?? [];
  return { ok: true, owns: items.length > 0 };
}

// ---- What IS this pass? ----------------------------------------------------

export type PassDetails = {
  id: string;
  name: string;
  priceRobux: number | null;
  forSale: boolean;
};

export type PassResult =
  | { ok: true; pass: PassDetails }
  | { ok: false; reason: "not_found" | "unavailable" };

/**
 * Name, price and sale state for a game pass. For the "Verify pass" button in the tier
 * editor, so a promoter finds out they pasted the wrong id NOW rather than at the show.
 *
 * NOT assetDetails() from lib/merch/roblox.ts, and this is the trap worth naming: that
 * function hits `economy.roblox.com/v2/assets/{id}/details`, which answers for CATALOG
 * ASSETS. A game pass is not a catalog asset. Point it at a pass id and it returns
 * `unavailable` forever - so the Verify button would confidently report every single real,
 * working, correctly-configured pass as broken, and nobody would ever work out why.
 */
export async function gamePassDetails(gamePassId: string): Promise<PassResult> {
  if (!/^\d{1,20}$/.test(gamePassId)) return { ok: false, reason: "not_found" };

  const res = await getJson<{
    TargetId?: number;
    Name?: string;
    PriceInRobux?: number | null;
    IsForSale?: boolean;
  }>(`https://apis.roblox.com/game-passes/v1/game-passes/${gamePassId}/product-info`);

  if (!res.ok) {
    if (res.status === 404 || res.status === 400) {
      return { ok: false, reason: "not_found" };
    }
    return { ok: false, reason: "unavailable" };
  }

  if (!res.data?.Name) return { ok: false, reason: "not_found" };

  return {
    ok: true,
    pass: {
      id: gamePassId,
      name: res.data.Name,
      // `?? null`, never `?? 0`. A pass Roblox gives no price for is not FREE, it is
      // off-sale and unpurchasable - and rendering it as "0 R$" would put a buy button on
      // a thing nobody can buy. Same distinction merch/price.ts makes, and for the same
      // reason.
      priceRobux:
        typeof res.data.PriceInRobux === "number" ? res.data.PriceInRobux : null,
      forSale: res.data.IsForSale === true,
    },
  };
}

/** Where a buyer goes to pay. The pass page on Roblox's own site. */
export function gamePassUrl(gamePassId: string) {
  return `https://www.roblox.com/game-pass/${gamePassId}`;
}

/**
 * The idempotency key for a game-pass payment. THE key design decision of this rail.
 *
 * "This person owns this pass" is a fact that can be honoured exactly ONCE - a pass is
 * owned forever and Roblox will never sell it to them twice. Encoding that into the
 * existing TicketPurchase.purchaseId unique constraint means the replay machinery already
 * built for ProcessReceipt gives this rail, for free: retry-safety, double-claim
 * protection, and a real payment ledger row.
 *
 * The alternative - keying on the intent token - is a trap that looks fine. Intents are
 * cheap and a buyer can mint a fresh one whenever they like, so the same pass could be
 * "paid" with over and over, each time writing a new TicketPurchase for money that changed
 * hands exactly once. The ledger would fill with payments that never happened.
 */
export function gamePassPurchaseId(gamePassId: string, robloxId: string) {
  return `gp:${gamePassId}:${robloxId}`;
}

import "server-only";
import { env } from "@/lib/env";

// The only file that talks to the Roblox catalog.
//
// ---- What Roblox will and will not tell an anonymous server ----------
//
// Verified against the live API, because the documentation does not say and the
// difference decided the whole design of the shop:
//
//   ✅ which items a group sells      catalog.roblox.com/v1/search/items
//   ✅ name, price, description       economy.roblox.com/v2/assets/{id}/details
//   ✅ product thumbnails             thumbnails.roblox.com/v1/assets
//   ❌ the 3D render                  thumbnails …/assets-thumbnail-3d  → 401
//   ❌ the clothing texture           assetdelivery.roblox.com/v1/asset → 401
//
// The last two need a logged-in Roblox cookie. That is why the 3D viewer is fed by
// an ADMIN UPLOAD of the template RNL already owns, rather than by a fetch: there
// is no credential here to expire, rotate, or quietly start 401ing in six months.
//
// ---- The rules everything below obeys -------------------------------
//
// Nothing here is called during a page render. Pages read the database; a sync
// writes it. Roblox rate-limits, and a shop that fetched on render would go blank
// for everyone the moment it got a 429 - on the night of a show, when the Discord
// link goes out and the traffic actually arrives.
//
// And every function FAILS SOFT. A sync that cannot reach Roblox returns what it
// managed to get and says so; it never returns an empty list that a caller might
// mistake for "the group sells nothing" and act on. See syncMerch in
// app/actions/merch.ts, which never deletes.

/** Roblox assetTypeId → what the texture wraps onto. Anything else is not clothing. */
const KIND_BY_ASSET_TYPE: Record<number, "SHIRT" | "TSHIRT" | "PANTS"> = {
  2: "TSHIRT",
  11: "SHIRT",
  12: "PANTS",
};

export type RobloxProduct = {
  assetId: string;
  kind: "SHIRT" | "TSHIRT" | "PANTS";
  name: string;
  description: string | null;
  priceRobux: number | null;
  forSale: boolean;
  limited: boolean;
  sales: number;
};

/** 10 seconds. A slow catalog must not hang an admin's "Sync now" click. */
const TIMEOUT_MS = 10_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET some JSON, with one retry.
 *
 * The retry is not defensive habit - it is load-bearing, and it was added because
 * the sync provably needed it. Roblox rate-limits per-endpoint, and a sync of even
 * five items makes five back-to-back calls to `economy`; the first run of this code
 * against the real store dropped an item on a 429. Silently. And because a failed
 * detail fetch is indistinguishable from "this isn't clothing" unless you make it
 * distinguishable, the shop simply had four shirts in it instead of five, and the
 * admin page cheerfully explained that the fifth was "not clothing".
 *
 * So: one retry after a pause, and - far more importantly - callers get to know
 * WHICH kind of nothing they got. See DetailResult below.
 */
async function getJson<T>(url: string, retries = 1): Promise<T | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        // Roblox's edge is friendlier to a request that names itself, and if RNL ever
        // does get rate-limited it should be obvious in their logs who it was.
        headers: {
          accept: "application/json",
          "user-agent": "ronation.live merch sync",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        // Belt and braces: this module must never end up memoised into a page render.
        cache: "no-store",
      });
      if (res.ok) return (await res.json()) as T;

      // 4xx that is not a rate limit means the answer will not change by asking
      // again - a deleted asset, a bad id. Only back off for the ones that might.
      const worthRetrying = res.status === 429 || res.status >= 500;
      if (!worthRetrying || attempt >= retries) return null;
    } catch {
      // Timeout, DNS, malformed JSON.
      if (attempt >= retries) return null;
    }

    await sleep(600 * (attempt + 1));
  }
}

/**
 * Every clothing asset the RNL group sells.
 *
 * `null` means Roblox could not be reached - which is NOT the same as an empty
 * array, and the difference is the whole safety property of the sync. An empty
 * array says "the group sells nothing", and a caller that acted on it would
 * unpublish the entire shop on the back of one 429.
 */
export async function discoverGroupAssets(): Promise<string[] | null> {
  const ids: string[] = [];
  let cursor = "";
  let ok = false;

  // Bounded. A cursor loop against somebody else's API is exactly where an infinite
  // loop comes from - a bug in their pagination becomes a hang in our admin page.
  for (let page = 0; page < 20; page++) {
    const url = new URL("https://catalog.roblox.com/v1/search/items");
    url.searchParams.set("category", "Clothing");
    url.searchParams.set("creatorTargetId", env.merch.groupId);
    url.searchParams.set("creatorType", "Group");
    url.searchParams.set("limit", "30");
    if (cursor) url.searchParams.set("cursor", cursor);

    const data = await getJson<{
      data?: { id: number }[];
      nextPageCursor?: string | null;
    }>(url.toString());

    // Failed on the FIRST page: we learned nothing, so say so.
    if (!data) return ok ? ids : null;

    ok = true;
    for (const item of data.data ?? []) ids.push(String(item.id));

    if (!data.nextPageCursor) break;
    cursor = data.nextPageCursor;
  }

  return ids;
}

/**
 * What came back for one asset - and the three cases are kept apart on purpose.
 *
 * `unavailable` and `not-clothing` are the SAME value (nothing) and completely
 * different facts, and collapsing them into one `null` is how the first run of this
 * sync lost a shirt: a rate-limited fetch looked exactly like "this asset is a decal",
 * so the item was dropped from the shop and the admin page reported it as skipped -
 * permanently, invisibly, and with a reason that was simply untrue.
 *
 *   unavailable   Roblox did not answer. Try again; change NOTHING in the meantime.
 *   not-clothing  Roblox answered, and it is a decal / model / audio. There is nothing
 *                 to wrap onto a character, so it is not merch. This will not change.
 */
export type DetailResult =
  | { ok: true; product: RobloxProduct }
  | { ok: false; reason: "unavailable" | "not-clothing" };

/**
 * Name, price and sale state for one asset.
 *
 * Deliberately the `economy` endpoint rather than `catalog/items/details`: the
 * latter is a POST that demands an X-CSRF token, which means a session, which means
 * a credential. This one is a plain GET and answers anonymously.
 */
export async function assetDetails(assetId: string): Promise<DetailResult> {
  const data = await getJson<{
    AssetId?: number;
    Name?: string;
    Description?: string;
    AssetTypeId?: number;
    PriceInRobux?: number | null;
    IsForSale?: boolean;
    IsLimited?: boolean;
    IsLimitedUnique?: boolean;
    Sales?: number;
  }>(`https://economy.roblox.com/v2/assets/${assetId}/details`);

  // No answer, or an answer we cannot read. Roblox's problem, not the asset's.
  if (!data?.Name || typeof data.AssetTypeId !== "number") {
    return { ok: false, reason: "unavailable" };
  }

  const kind = KIND_BY_ASSET_TYPE[data.AssetTypeId];
  if (!kind) return { ok: false, reason: "not-clothing" };

  return {
    ok: true,
    product: {
      assetId,
      kind,
      name: data.Name,
      description: data.Description?.trim() || null,
      // `?? null`, never `?? 0`: an item Roblox gives no price for is not free, it is
      // unpurchasable, and the shop renders those differently.
      priceRobux: typeof data.PriceInRobux === "number" ? data.PriceInRobux : null,
      forSale: data.IsForSale === true,
      limited: data.IsLimited === true || data.IsLimitedUnique === true,
      sales: typeof data.Sales === "number" ? data.Sales : 0,
    },
  };
}

/**
 * Thumbnails, batched. assetId → image URL, for the ones Roblox has rendered.
 *
 * A missing entry is normal (Roblox renders asynchronously, and a brand new upload
 * comes back "Pending"), so a caller must treat absence as "no picture yet" rather
 * than as an error.
 */
export async function thumbnails(assetIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();

  // Roblox caps the batch. 100 is inside every limit they publish.
  for (let i = 0; i < assetIds.length; i += 100) {
    const chunk = assetIds.slice(i, i + 100);
    const url = new URL("https://thumbnails.roblox.com/v1/assets");
    url.searchParams.set("assetIds", chunk.join(","));
    url.searchParams.set("size", "420x420");
    url.searchParams.set("format", "Png");

    const data = await getJson<{
      data?: { targetId: number; state: string; imageUrl?: string }[];
    }>(url.toString());

    for (const t of data?.data ?? []) {
      // "Completed" is the only state with a picture behind it. "Pending" and
      // "Blocked" both come back with a placeholder URL that would render as a grey
      // square forever, cached, with nothing to say why.
      if (t.state === "Completed" && t.imageUrl) {
        out.set(String(t.targetId), t.imageUrl);
      }
    }
  }

  return out;
}

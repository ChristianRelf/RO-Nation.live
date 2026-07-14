import "server-only";
import { prisma } from "@/lib/db";
import { uniqueSlug } from "@/lib/content";
import { assetDetails, discoverGroupAssets, thumbnails } from "./roblox";

/**
 * Pull the Roblox group's store into the database.
 *
 * Deliberately NOT a server action, and not guarded. It is the *work*; the guard is
 * the caller's (app/actions/merch.ts opens with requireCompanyUser(), as every
 * company action does). Splitting them this way means the sync can be run from a
 * script - against the real Roblox API and the real database - without either
 * inventing a fake session or, far worse, testing a second copy of this logic that
 * is free to drift from the one that actually runs.
 *
 * ---- The one rule -------------------------------------------------
 *
 * **It never deletes, and it never writes a curated field.**
 *
 * This talks to somebody else's rate-limited API. If a 429, a timeout or a
 * moderation action could remove rows, one bad afternoon at Roblox would silently
 * unpublish the shop and destroy every collection assignment and every uploaded
 * texture - none of which can be recovered by clicking Sync again. So an item that
 * disappears from the catalog is marked off-sale and left exactly where it is, for
 * a human to hide. Losing a shirt from a shelf is a five-second fix. Losing the
 * shelf is not.
 *
 * Returns null when Roblox could not be reached at all, which is NOT the same as an
 * empty catalogue - see discoverGroupAssets().
 */
export type SyncResult = {
  added: number;
  updated: number;
  /** Roblox answered, and it is not clothing. Permanent; nothing to do. */
  skipped: number;
  /** Roblox did not answer. Transient - these come back on the next sync. */
  failed: number;
};

/** Roblox rate-limits per endpoint, and a sync is a burst of calls to one of them. */
const PACE_MS = 250;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runMerchSync(): Promise<SyncResult | null> {
  const ids = await discoverGroupAssets();
  if (ids === null) return null;
  if (ids.length === 0) return { added: 0, updated: 0, skipped: 0, failed: 0 };

  const thumbs = await thumbnails(ids);

  let added = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const [i, assetId] of ids.entries()) {
    // Paced, not blasted. Five back-to-back calls to `economy` was enough to earn a
    // 429 from Roblox on the very first real run of this sync, which cost a shirt.
    // A quarter of a second between items is invisible to the person who clicked
    // Sync and is the difference between a catalogue that is complete and one that
    // is quietly short.
    if (i > 0) await sleep(PACE_MS);

    const result = await assetDetails(assetId);

    if (!result.ok) {
      // The distinction is the whole point - see DetailResult in ./roblox.
      // Neither case writes anything: an existing row keeps its data and its shelf.
      if (result.reason === "unavailable") failed++;
      else skipped++;
      continue;
    }

    const details = result.product;

    const existing = await prisma.merchProduct.findUnique({
      where: { assetId },
      select: { id: true },
    });

    const fromRoblox = {
      kind: details.kind,
      name: details.name,
      description: details.description,
      priceRobux: details.priceRobux,
      forSale: details.forSale,
      limited: details.limited,
      sales: details.sales,
      // `?? null`, not "keep the old one": a thumbnail Roblox has stopped rendering
      // is one that no longer loads, and holding on to the URL would leave a broken
      // image on the shelf instead of falling back to the placeholder.
      thumbnailUrl: thumbs.get(assetId) ?? null,
      syncedAt: new Date(),
    };

    if (existing) {
      // Note what is absent: slug, collection, order, visible, textureUrl. The sync
      // owns Roblox's half of the row and nothing else.
      await prisma.merchProduct.update({
        where: { id: existing.id },
        data: fromRoblox,
      });
      updated++;
      continue;
    }

    await prisma.merchProduct.create({
      data: {
        assetId,
        ...fromRoblox,
        // Derived ONCE, here, and never again - a shirt renamed on Roblox must not
        // rot a link somebody has already shared.
        slug: await uniqueSlug(details.name, "merch"),
        // Unplaced and invisible: a new item shows up in the admin and nowhere else
        // until somebody puts it on a shelf. This is what stops a test upload in the
        // Roblox group appearing on the live shop by itself.
        collection: null,
        visible: false,
      },
    });
    added++;
  }

  return { added, updated, skipped, failed };
}

import "server-only";
import { readFile } from "fs/promises";
import sharp from "sharp";
import { PRIVATE_UPLOAD_DIR, resolveInRoot } from "@/lib/uploads";
import { cellAt, gridFor, permutation, scrambles, CELL } from "./scramble";
import { DECAL, DECAL_SIZE, tileRect } from "./tiles";

// Cutting one face out of the template, and shredding it.
//
// This is the only code in the application that opens a clothing template, and the
// only thing it ever returns is a single face of a single cube - never the sheet.

/**
 * Cut `tileId` out of the template at `storagePath`, shuffled by `seed`.
 *
 * `storagePath` is a private-volume path (`rnl/<uuid>.png`) out of the database, and
 * it is resolved back inside that root before anything is opened: it is our own UUID
 * and never a user's string, but a column is one careless migration away from holding
 * "../../.env" and the check costs nothing.
 */
async function cut(
  storagePath: string,
  tileId: string,
  seed: string,
): Promise<Buffer | null> {
  const file = resolveInRoot(PRIVATE_UPLOAD_DIR, storagePath);
  if (!file) return null;

  let bytes: Buffer;
  try {
    bytes = await readFile(file);
  } catch {
    // The row points at a file that is not on the volume - a restored database
    // without its uploads, most likely. A missing shirt, not a crash.
    return null;
  }

  const rect = tileRect(tileId);

  // Down to raw RGBA, because the shuffle below moves blocks of pixels and a PNG is
  // not a grid of pixels - it is a compressed stream of them.
  const source =
    tileId === DECAL
      ? // The decal is normalised to a square: the shuffle needs whole 16px cells,
        // which an arbitrary upload will not give. `contain` keeps the artwork's
        // aspect and pads with transparency rather than cropping it, which is what
        // Roblox does with a t-shirt decal anyway.
        sharp(bytes).resize(DECAL_SIZE, DECAL_SIZE, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
      : rect
        ? sharp(bytes).extract({
            left: rect.x,
            top: rect.y,
            width: rect.w,
            height: rect.h,
          })
        : null;

  if (!source) return null;

  let data: Buffer;
  let info: { width: number; height: number; channels: number };
  try {
    // ensureAlpha, because a template saved without one comes back 3-channel and every
    // stride below would be off by a byte - which does not throw, it just produces a
    // sheared rainbow.
    const out = await source
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    data = out.data;
    info = out.info;
  } catch {
    // Not a decodable image, or the rectangle falls outside it - somebody uploaded a
    // 512x512 instead of the 585x559 template. Refuse the tile; the page shows the
    // Roblox render instead of half a shirt.
    return null;
  }

  const { width, height } = info;

  if (scrambles(width, height)) {
    const grid = gridFor(width, height);
    const perm = permutation(seed, grid.count);
    const shredded = Buffer.allocUnsafe(data.length);

    // out[i] = src[perm[i]]. The browser holds `out` and wants `src`, so it runs the
    // same array the other way round - see the note on permutation() in scramble.ts.
    for (let i = 0; i < grid.count; i++) {
      const to = cellAt(i, grid);
      const from = cellAt(perm[i], grid);

      // A cell is CELL rows of CELL pixels, and the rows are not contiguous in a
      // row-major buffer - so it is copied a scanline at a time.
      for (let row = 0; row < CELL; row++) {
        const src = ((from.y + row) * width + from.x) * 4;
        const dst = ((to.y + row) * width + to.x) * 4;
        data.copy(shredded, dst, src, src + CELL * 4);
      }
    }

    data = shredded;
  }

  return sharp(data, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// ---- The cache ------------------------------------------------------------
//
// A tile is a pure function of (file, tile, seed) and the seed is the token, so the
// same request always produces the same bytes. The response is already sent with a
// one-year immutable cache, so a warm browser never comes back - but a cold product
// page asks for eighteen tiles at once, and every one of them decodes the same PNG
// off the same volume. This keeps that at one decode per tile for the life of the
// process, which is the difference between a page that opens and a page that thinks
// about it.
//
// Bounded, and bounded by COUNT rather than by bytes, because these are small and
// predictable: a 64x128 face is a few KB. 512 tiles is roughly thirty products' worth
// of fully-viewed shirts, and the whole shop is smaller than that.
const CACHE_MAX = 512;
const cache = new Map<string, Buffer>();

export async function plateTile(
  storagePath: string,
  tileId: string,
  token: string,
): Promise<Buffer | null> {
  const hit = cache.get(token);
  if (hit) {
    // Re-inserted so the eviction below is least-recently-USED and not merely
    // least-recently-written: the tiles of the shirt everybody is looking at should
    // not age out behind one crawl of the archive.
    cache.delete(token);
    cache.set(token, hit);
    return hit;
  }

  const png = await cut(storagePath, tileId, token);
  if (!png) return null;

  cache.set(token, png);
  if (cache.size > CACHE_MAX) {
    // Map iterates in insertion order, so the first key is the oldest.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }

  return png;
}

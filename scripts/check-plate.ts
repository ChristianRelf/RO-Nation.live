/**
 * Does a shirt survive the round trip?
 *
 *   npm run merch:check
 *
 * The server shreds a face (lib/merch/plate.ts); the browser puts it back
 * (components/shop/avatar-viewer.tsx). Both halves derive the same permutation from the
 * same token, in the same shared module - and if they ever stop agreeing, NOTHING
 * THROWS. Every shirt in the shop just renders as confetti, which reads as "the artwork
 * is bad" rather than "the code is bad", and survives a glance at a page you have looked
 * at a hundred times.
 *
 * That is the same class of silent failure the UV mapping has (see the note at the top
 * of lib/merch/uv.ts), and it gets the same answer: the arithmetic is pure, so it is
 * checked without a GPU and without a browser.
 *
 * What is asserted, per face of a shirt:
 *
 *   1. the seal round-trips, and a tampered token does not open
 *   2. the tile comes back at the size the template says that face is
 *   3. the bytes served are NOT the original - the shuffle actually shuffled. A no-op
 *      permutation would pass every other check here and protect nothing.
 *   4. the browser's half recovers the original BYTE FOR BYTE
 *
 * It runs against a synthetic template of high-frequency noise, deliberately: a flat
 * colour would round-trip perfectly even if the permutation were completely wrong.
 *
 * `--conditions=react-server` is not optional (see the npm script). lib/merch/tiles.ts
 * opens with `import "server-only"`, a module whose entire job is to throw when it is
 * imported outside a server component. That condition is what makes it resolve to the
 * empty stub instead, which is exactly what Next does when it builds the real thing.
 */

import { mkdtempSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import sharp from "sharp";

// Set before ANY of the modules under test are loaded - which is why they are pulled in
// by dynamic import inside main(), and not by a static import up here. lib/uploads.ts
// reads PRIVATE_UPLOAD_DIR at module load, and a static import would have run before
// these lines did. (Synchronous mkdtemp for the same reason: the package is CommonJS, so
// there is no top-level await available to order this any other way.)
const DIR = mkdtempSync(path.join(tmpdir(), "rnl-plate-"));
process.env.PRIVATE_UPLOAD_DIR = DIR;
process.env.AUTH_SECRET ||= "a-secret-that-only-this-check-uses";

const W = 585;
const H = 559;

async function main() {
  const { plateTile } = await import("@/lib/merch/plate");
  const { openTile, sealTile, tileIds, tileRect } = await import("@/lib/merch/tiles");
  const { CELL, cellAt, gridFor, permutation, scrambles } = await import(
    "@/lib/merch/scramble"
  );

  /**
   * The browser's half, exactly as avatar-viewer.tsx does it.
   *
   * `ctx.drawImage(img, from.x, from.y, CELL, CELL, to.x, to.y, CELL, CELL)` is a block
   * copy of one cell, so this is that same block copy against raw bytes. If this and the
   * viewer ever drift apart, this check is worthless - so keep them in step.
   */
  const unshred = (shredded: Buffer, w: number, h: number, token: string): Buffer => {
    if (!scrambles(w, h)) return shredded;

    const grid = gridFor(w, h);
    const perm = permutation(token, grid.count);
    const out = Buffer.allocUnsafe(shredded.length);

    for (let i = 0; i < grid.count; i++) {
      const from = cellAt(i, grid);
      const to = cellAt(perm[i], grid);
      for (let row = 0; row < CELL; row++) {
        const s = ((from.y + row) * w + from.x) * 4;
        const d = ((to.y + row) * w + to.x) * 4;
        shredded.copy(out, d, s, s + CELL * 4);
      }
    }
    return out;
  };

  // ---- A synthetic template ------------------------------------------
  const noise = Buffer.allocUnsafe(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      noise[i] = (x * 7 + y * 3) & 0xff;
      noise[i + 1] = (x * 13 + 29) & 0xff;
      noise[i + 2] = (y * 11 + 71) & 0xff;
      noise[i + 3] = 255;
    }
  }

  const template = await sharp(noise, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toBuffer();

  await mkdir(path.join(DIR, "rnl"), { recursive: true });
  await writeFile(path.join(DIR, "rnl", "t.png"), template);

  let pass = 0;
  let fail = 0;
  const bad = (msg: string) => {
    console.error(`  ✗ ${msg}`);
    fail++;
  };

  for (const id of tileIds("SHIRT")) {
    const token = sealTile("product-abc", id);

    const opened = openTile(token);
    if (opened?.productId !== "product-abc" || opened.tileId !== id) {
      bad(`${id}: the seal did not round-trip`);
      continue;
    }

    const png = await plateTile("rnl/t.png", id, token);
    if (!png) {
      bad(`${id}: plateTile returned null`);
      continue;
    }

    const { data: served, info } = await sharp(png)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const rect = tileRect(id);
    if (!rect) {
      bad(`${id}: the template has no rectangle for this tile`);
      continue;
    }

    const { data: original } = await sharp(template)
      .extract({ left: rect.x, top: rect.y, width: rect.w, height: rect.h })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (info.width !== rect.w || info.height !== rect.h) {
      bad(
        `${id}: served ${info.width}x${info.height}, the template says ${rect.w}x${rect.h}`,
      );
      continue;
    }

    if (served.equals(original)) {
      bad(`${id}: served UNSHREDDED - the shuffle did nothing`);
      continue;
    }

    const recovered = unshred(served, info.width, info.height, token);
    if (!recovered.equals(original)) {
      let diff = 0;
      for (let i = 0; i < recovered.length; i++) {
        if (recovered[i] !== original[i]) diff++;
      }
      bad(`${id}: recovered != original (${diff} of ${recovered.length} bytes differ)`);
      continue;
    }

    console.log(
      `  ✓ ${id.padEnd(9)} ${String(rect.w).padStart(3)}x${rect.h} - shredded, recovered byte-identical`,
    );
    pass++;
  }

  // A token somebody edited by one character must not open. This is the whole reason the
  // seal is authenticated encryption rather than a reversible encoding: without it the
  // product id is a field anybody can rewrite, and a hidden product is one guess away.
  const token = sealTile("product-abc", "t.front");
  const tampered = token.slice(0, -3) + (token.endsWith("AAA") ? "BBB" : "AAA");
  if (openTile(tampered)) {
    bad("a tampered token opened");
  } else {
    console.log("  ✓ a tampered token is refused");
    pass++;
  }

  // And the same face of two different products must not seal to the same token, or one
  // shirt's URLs would serve another's artwork.
  if (sealTile("product-xyz", "t.front") === token) {
    bad("two different products sealed to the same token");
  } else {
    console.log("  ✓ different products seal to different tokens");
    pass++;
  }

  console.log(`\n${pass} passed, ${fail} failed.`);
  if (fail) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

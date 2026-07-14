// How a face tile is shredded on the way out, and put back together on the way in.
//
// This module is ISOMORPHIC and that is the whole point: the server dices a tile
// with it (lib/merch/plate.ts) and the browser undoes exactly that dicing with it
// (components/shop/avatar-viewer.tsx). One permutation, one implementation, no way
// for the two halves to drift apart into a shirt with its sleeves diced.
//
// ---- What this does and does not buy you ----------------------------------
//
// It means a tile fetched on its own - by curl, by a right-click, by a scraper
// walking the network tab - is visually shredded. It is NOT encryption: the
// permutation is derived from the tile's own token by the code below, and that code
// ships to the browser, because it has to. Anyone willing to read our JavaScript can
// reverse it.
//
// That is the correct trade, and it is worth being clear-eyed about why. The texture
// has to reach a GPU to be drawn, so a determined, competent thief can ALWAYS get it
// back - if not from the network then by reading the canvas or hooking three.js.
// There is no version of this that is airtight, and a design that pretends otherwise
// would just be more code. What is achievable is making theft cost real effort
// instead of one right-click, and making it impossible to do in bulk. Between the
// private volume (the flat is never served), the sealed per-face URLs (nothing is
// enumerable) and this shuffle (nothing downloaded is usable as-is), a scraper gets
// eighteen unlabelled squares of confetti.

/**
 * The cell the shuffle works in, in template pixels.
 *
 * 16 divides every rectangle in template.ts (they are all multiples of 64) and it
 * divides the t-shirt decal too, because plate.ts normalises that to 512x512 before
 * it gets here. So the grid is always whole cells - which matters, since cells can
 * only be shuffled into each other's slots if they are all the same size.
 *
 * Smaller shreds harder and costs more cells; 16 puts a 64x128 sleeve at 32 cells and
 * the torso's front panel at 64, which is well past the point where the artwork is
 * readable by eye.
 */
export const CELL = 16;

export type Grid = { cols: number; rows: number; count: number };

export function gridFor(width: number, height: number): Grid {
  const cols = Math.floor(width / CELL);
  const rows = Math.floor(height / CELL);
  return { cols, rows, count: cols * rows };
}

/** Whether a tile can be shuffled at all: the grid has to come out whole. */
export function scrambles(width: number, height: number): boolean {
  return width % CELL === 0 && height % CELL === 0 && width >= CELL && height >= CELL;
}

/** Top-left corner of cell `i`, in pixels. */
export function cellAt(i: number, grid: Grid): { x: number; y: number } {
  return {
    x: (i % grid.cols) * CELL,
    y: Math.floor(i / grid.cols) * CELL,
  };
}

// ---- The permutation ------------------------------------------------------
//
// Seeded from the tile's sealed token, so every tile of every product shuffles
// differently and the same tile shuffles the same way every time - which is what lets
// the response be cached immutably rather than regenerated per request.
//
// Both halves must agree bit for bit, so this is written in integer operations that
// mean the same thing in every JavaScript engine: no floats, no Math.random, no
// crypto, nothing whose output could vary between Node and a browser.

/** FNV-1a, 32-bit. A string to a seed. */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    // The FNV prime, by shift-and-add - `h * 16777619` would lose the top bits to
    // float64 rounding long before it wrapped.
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  // A zero seed would leave xorshift stuck at zero forever, emitting the identity
  // permutation - i.e. no shuffle at all, silently.
  return h === 0 ? 0x9e3779b9 : h;
}

/** xorshift32. Small, fast, and identical everywhere. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s;
  };
}

/**
 * The shuffle, as a lookup: `perm[i]` is the SOURCE cell that ends up in slot `i`.
 *
 * So the server writes `out[i] = src[perm[i]]`, and the browser - holding `out` and
 * wanting `src` back - writes `src[perm[i]] = out[i]`. Same array, read the other way
 * round. Getting that backwards produces a shirt that is scrambled rather than an
 * error, so it is spelled out here and used in exactly those two places.
 */
export function permutation(seed: string, count: number): Uint16Array {
  const perm = new Uint16Array(count);
  for (let i = 0; i < count; i++) perm[i] = i;

  const next = rng(hash(seed));
  // Fisher-Yates, downward. Unbiased enough at these sizes; the modulo skew across a
  // 32-bit range and a few hundred cells is not a property anybody can exploit.
  for (let i = count - 1; i > 0; i--) {
    const j = next() % (i + 1);
    const t = perm[i];
    perm[i] = perm[j];
    perm[j] = t;
  }

  return perm;
}

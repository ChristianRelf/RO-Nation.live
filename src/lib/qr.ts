// A real QR Code encoder. Byte mode, error-correction level H.
//
// This replaces the decorative "QR-shaped" mark the tickets used to carry, which
// was a hash sprayed into a grid and scanned as nothing at all. A ticket is the
// one artefact a person actually points a camera at, so the mark on it has to be
// the real thing — ISO/IEC 18004, the same standard every phone camera decodes.
//
// Why write it rather than install `qrcode`:
//   - It is ~200 lines of a fully specified standard, and it is verifiable: the
//     matrix either decodes back to the payload or it does not. There is no
//     judgement call to get wrong, and no upgrade treadmill for a format that
//     was frozen in 2006.
//   - It has to run in a *server component* (the ticket renders on the server,
//     several to a page), so it must be pure, synchronous and dependency-free.
//     Most QR packages are canvas- or DOM-bound.
//
// Why level H (30% recovery) and not the smaller, denser levels: the ticket
// punches a brand badge through the middle of the mark. H is what buys back the
// modules that badge covers — see components/ticket/ticket-qr.tsx, which sizes
// the badge against the budget H gives it.
//
// Only versions 1–10 are supported, which at level H tops out at 119 bytes. A
// ticket URL is ~50. Anything longer is a bug in the caller, not a QR that needs
// a bigger version, so it throws rather than silently growing the grid.

/** The format-info bits for error-correction level H. (L=01, M=00, Q=11, H=10.) */
const ECC_H = 0b10;

/**
 * Per version: [EC codewords per block, blocks in group 1, data codewords per
 * group-1 block, blocks in group 2, data codewords per group-2 block].
 *
 * Straight from the level-H column of the ISO block table. Group 2 is the
 * "one codeword longer" group that exists when the data doesn't divide evenly.
 */
const BLOCKS_H: readonly (readonly [number, number, number, number, number])[] = [
  [17, 1, 9, 0, 0], //  v1
  [28, 1, 16, 0, 0], //  v2
  [22, 2, 13, 0, 0], //  v3
  [16, 4, 9, 0, 0], //  v4
  [22, 2, 11, 2, 12], //  v5
  [28, 4, 15, 0, 0], //  v6
  [26, 4, 13, 1, 14], //  v7
  [26, 4, 14, 2, 15], //  v8
  [24, 4, 12, 4, 13], //  v9
  [28, 6, 15, 2, 16], // v10
];

/** Centre coordinates of the alignment patterns, per version. */
const ALIGN: readonly (readonly number[])[] = [
  [], //  v1 — none
  [6, 18], //  v2
  [6, 22], //  v3
  [6, 26], //  v4
  [6, 30], //  v5
  [6, 34], //  v6
  [6, 22, 38], //  v7
  [6, 24, 42], //  v8
  [6, 26, 46], //  v9
  [6, 28, 50], // v10
];

// ---- GF(256) -------------------------------------------------------------
// Reed-Solomon runs over the field defined by the primitive polynomial 0x11D.
// Log/antilog tables turn multiplication into an addition of exponents.

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  // Doubled so `LOG[a] + LOG[b]` (max 508) can index without a modulo.
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

const mul = (a: number, b: number) =>
  a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];

/** The generator polynomial (x-α⁰)(x-α¹)…, highest power first. */
function generatorPoly(degree: number) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/** The Reed-Solomon remainder — i.e. the error-correction codewords. */
function eccFor(data: readonly number[], ecLen: number) {
  const gen = generatorPoly(ecLen);
  const rem = new Array<number>(ecLen).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem[0];
    rem.shift();
    rem.push(0);
    for (let i = 0; i < ecLen; i++) rem[i] ^= mul(gen[i + 1], factor);
  }
  return rem;
}

// ---- Bit stream ----------------------------------------------------------

const dataCodewordsFor = (version: number) => {
  const [, b1, d1, b2, d2] = BLOCKS_H[version - 1];
  return b1 * d1 + b2 * d2;
};

/** Byte mode's character-count field is 8 bits below v10, 16 bits from v10 up. */
const countBits = (version: number) => (version < 10 ? 8 : 16);

function pickVersion(byteLength: number) {
  for (let v = 1; v <= 10; v++) {
    const available = dataCodewordsFor(v) * 8 - 4 - countBits(v);
    if (available >= byteLength * 8) return v;
  }
  throw new Error(
    `QR payload of ${byteLength} bytes exceeds the version-10 level-H limit of 119`,
  );
}

/** Mode indicator + length + payload + terminator + padding, as codewords. */
function encodeData(bytes: Uint8Array, version: number) {
  const capacity = dataCodewordsFor(version) * 8;
  const bits: number[] = [];
  const push = (value: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };

  push(0b0100, 4); // byte mode
  push(bytes.length, countBits(version));
  for (const b of bytes) push(b, 8);

  push(0, Math.min(4, capacity - bits.length)); // terminator
  while (bits.length % 8 !== 0) bits.push(0); // pad to a whole codeword

  const words: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    words.push(byte);
  }
  // The spec's pad bytes, alternating, until the block is full.
  for (let pad = 0xec; words.length < capacity / 8; pad ^= 0xec ^ 0x11) {
    words.push(pad);
  }
  return words;
}

/** Split into blocks, add ECC to each, then interleave — as the spec requires. */
function interleave(data: readonly number[], version: number) {
  const [ecLen, b1, d1, b2, d2] = BLOCKS_H[version - 1];
  const blockCount = b1 + b2;

  const dataBlocks: number[][] = [];
  const eccBlocks: number[][] = [];
  let at = 0;
  for (let i = 0; i < blockCount; i++) {
    const len = i < b1 ? d1 : d2;
    const block = data.slice(at, at + len);
    at += len;
    dataBlocks.push(block);
    eccBlocks.push(eccFor(block, ecLen));
  }

  const out: number[] = [];
  const longest = Math.max(d1, d2);
  for (let i = 0; i < longest; i++) {
    for (const block of dataBlocks) if (i < block.length) out.push(block[i]);
  }
  for (let i = 0; i < ecLen; i++) {
    for (const block of eccBlocks) out.push(block[i]);
  }
  return Uint8Array.from(out);
}

// ---- Matrix --------------------------------------------------------------

const bit = (value: number, i: number) => ((value >>> i) & 1) !== 0;

/**
 * The eight mask patterns. Applied to data modules only; the encoder tries all
 * eight and keeps whichever scores the lowest penalty, which is what stops a
 * payload from producing a grid full of big solid blocks a scanner would choke
 * on.
 */
const MASKS: readonly ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (((y / 2) | 0) + ((x / 3) | 0)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

class Builder {
  readonly size: number;
  readonly modules: boolean[][];
  /** Function patterns are fixed: they take no data and no mask. */
  private readonly reserved: boolean[][];

  constructor(readonly version: number) {
    this.size = version * 4 + 17;
    const blank = () =>
      Array.from({ length: this.size }, () =>
        new Array<boolean>(this.size).fill(false),
      );
    this.modules = blank();
    this.reserved = blank();
  }

  private set(x: number, y: number, dark: boolean) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
    this.modules[y][x] = dark;
    this.reserved[y][x] = true;
  }

  /** Finder (7×7) plus its separator, as one 9×9 stamp centred on (cx, cy). */
  private finder(cx: number, cy: number) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        // Chebyshev distance gives the concentric rings: dark, light, dark, light.
        const ring = Math.max(Math.abs(dx), Math.abs(dy));
        this.set(cx + dx, cy + dy, ring !== 2 && ring !== 4);
      }
    }
  }

  private alignment(cx: number, cy: number) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  functionPatterns() {
    for (let i = 0; i < this.size; i++) {
      this.set(6, i, i % 2 === 0); // vertical timing
      this.set(i, 6, i % 2 === 0); // horizontal timing
    }

    // Deliberately after the timing pass: a finder overwrites the timing modules
    // that fall inside its 9×9 stamp, and that is what the spec asks for.
    this.finder(3, 3);
    this.finder(this.size - 4, 3);
    this.finder(3, this.size - 4);

    const pos = ALIGN[this.version - 1];
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        // The three corners are where the finders already are.
        const corner =
          (i === 0 && j === 0) ||
          (i === 0 && j === pos.length - 1) ||
          (i === pos.length - 1 && j === 0);
        if (!corner) this.alignment(pos[i], pos[j]);
      }
    }

    this.version_();

    // Reserve the format modules so the data pass steps over them. Done by
    // writing a throwaway mask-0 block rather than by blanking the two lines
    // x=8 and y=8 wholesale: those lines cross the timing patterns at (8,6) and
    // (6,8), which are NOT format modules, and blanking them silently corrupts
    // the timing pattern. format() touches only the real positions.
    this.format(0);
  }

  /** The 18-bit version block, on v7 and up. BCH(18,6), generator 0x1F25. */
  private version_() {
    if (this.version < 7) return;
    let rem = this.version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.version << 12) | rem;

    for (let i = 0; i < 18; i++) {
      const dark = bit(bits, i);
      const a = this.size - 11 + (i % 3);
      const b = (i / 3) | 0;
      this.set(a, b, dark); // top-right block
      this.set(b, a, dark); // bottom-left block
    }
  }

  /** The 15-bit format block, written twice. BCH(15,5), generator 0x537. */
  format(mask: number) {
    const data = (ECC_H << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;

    for (let i = 0; i <= 5; i++) this.set(8, i, bit(bits, i));
    this.set(8, 7, bit(bits, 6));
    this.set(8, 8, bit(bits, 7));
    this.set(7, 8, bit(bits, 8));
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(bits, i));

    for (let i = 0; i < 8; i++) this.set(this.size - 1 - i, 8, bit(bits, i));
    for (let i = 8; i < 15; i++) this.set(8, this.size - 15 + i, bit(bits, i));

    this.set(8, this.size - 8, true); // the always-dark module
  }

  /** Zigzag the codewords up and down two-column strips, right to left. */
  codewords(data: Uint8Array) {
    let i = 0;
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5; // step over the vertical timing column
      for (let v = 0; v < this.size; v++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? this.size - 1 - v : v;
          if (!this.reserved[y][x] && i < data.length * 8) {
            this.modules[y][x] = bit(data[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }
  }

  applyMask(mask: number) {
    const fn = MASKS[mask];
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (!this.reserved[y][x] && fn(x, y)) {
          this.modules[y][x] = !this.modules[y][x];
        }
      }
    }
  }

  /** The spec's four penalty rules. Lower is more scannable. */
  penalty() {
    const n = this.size;
    const m = this.modules;
    let score = 0;

    // Rule 1 — runs of five or more same-coloured modules in a line.
    const runs = (get: (a: number, b: number) => boolean) => {
      for (let a = 0; a < n; a++) {
        let run = 1;
        for (let b = 1; b < n; b++) {
          if (get(a, b) === get(a, b - 1)) {
            run++;
          } else {
            if (run >= 5) score += run - 2;
            run = 1;
          }
        }
        if (run >= 5) score += run - 2;
      }
    };
    runs((y, x) => m[y][x]);
    runs((x, y) => m[y][x]);

    // Rule 2 — every 2×2 block of one colour.
    for (let y = 0; y < n - 1; y++) {
      for (let x = 0; x < n - 1; x++) {
        const c = m[y][x];
        if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) {
          score += 3;
        }
      }
    }

    // Rule 3 — the finder-lookalike 1:1:3:1:1 pattern with four light modules
    // on either side, which is what actually confuses a scanner.
    const FINDER = [true, false, true, true, true, false, true];
    const LIGHT4 = [false, false, false, false];
    const matches = (line: boolean[], at: number, pat: boolean[]) =>
      pat.every((p, k) => line[at + k] === p);

    for (let a = 0; a < n; a++) {
      const row = m[a];
      const col = m.map((r) => r[a]);
      for (const line of [row, col]) {
        for (let x = 0; x + 6 < n; x++) {
          if (!matches(line, x, FINDER)) continue;
          // Light-run on each side is a *separate* occurrence, so a lookalike
          // fenced by four light modules on both sides scores twice. Counting it
          // once (the tempting `before || after`) systematically under-penalises
          // the worst grids and picks a different mask to the reference encoders.
          if (x - 4 >= 0 && matches(line, x - 4, LIGHT4)) score += 40;
          if (x + 11 <= n && matches(line, x + 7, LIGHT4)) score += 40;
        }
      }
    }

    // Rule 4 — deviation from a 50/50 dark ratio.
    let dark = 0;
    for (const row of m) for (const c of row) if (c) dark++;
    const percent = (dark * 100) / (n * n);
    score += Math.floor(Math.abs(percent - 50) / 5) * 10;

    return score;
  }
}

/**
 * Encode `text` and return the module grid — `true` is a dark module.
 *
 * The grid carries NO quiet zone. That is the renderer's job, and it is not
 * optional: without four light modules of margin the mark is undecodable no
 * matter how correct the grid is. See ticket-qr.tsx's viewBox.
 */
export function qrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const version = pickVersion(bytes.length);
  const codewords = interleave(encodeData(bytes, version), version);

  let best: boolean[][] | null = null;
  let bestScore = Infinity;

  for (let mask = 0; mask < 8; mask++) {
    const qr = new Builder(version);
    qr.functionPatterns();
    qr.codewords(codewords);
    qr.applyMask(mask);
    qr.format(mask);

    const score = qr.penalty();
    if (score < bestScore) {
      bestScore = score;
      best = qr.modules;
    }
  }

  // Unreachable — the loop always runs — but it is what makes the return type
  // honest without a non-null assertion.
  if (!best) throw new Error("QR: no mask produced a matrix");
  return best;
}

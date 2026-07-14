// Code 128 (subset B) - the barcode down the side of the ticket.
//
// It is a REAL barcode. Point a scanner at it and it reads the ticket code back,
// character for character. That matters more than it sounds: the obvious way to
// draw a barcode is to hash the string into a row of random-width bars, which
// photographs beautifully and scans as absolutely nothing - the same trap the QR
// on this ticket used to be in (see the note in ticket-qr.tsx).
//
// The door already accepts a typed code and a scanned QR. A working barcode means
// a crew member with a cheap USB laser scanner - the thing every real venue has -
// can check somebody in without a phone camera.
//
// Subset B covers ASCII 32–126, which is every character a ticket code can hold
// (uppercase letters, digits and the hyphen: "ST-4K9QW2"), so there is no need
// for the subset-switching machinery of a full implementation.

/**
 * The 107 Code 128 symbols. Each is six element widths, alternating
 * bar-space-bar-space-bar-space, and each symbol is 11 modules wide.
 *
 * Do not "tidy" this table. It is fixed by the specification: an off-by-one here
 * is a barcode that looks perfect and decodes to the wrong string, which is worse
 * than one that fails to decode at all.
 */
const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312",
  "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222",
  "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131",
  "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321",
  "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
  "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224",
  "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
  "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112",
  "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
  "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412",
  "211214", "211232", "233111",
];

/** START B. Subset B is the only one we need - see the note above. */
const START_B = 104;
/** STOP. Seven elements, not six: the final one is the terminating bar. */
const STOP = "2331112";

/** One element of the barcode: a run of `width` modules, ink or paper. */
export type BarcodeElement = { width: number; bar: boolean };

export type Barcode = {
  elements: BarcodeElement[];
  /** Total width in modules - what you divide by to fit it into a box. */
  modules: number;
};

/**
 * Encode `text` as Code 128 B.
 *
 * Characters outside ASCII 32–126 are dropped rather than mangled: a ticket code
 * can't contain any, and silently substituting one would produce a barcode that
 * scans to a code no ticket has.
 */
export function code128(text: string): Barcode {
  const values: number[] = [];
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if (c >= 32 && c <= 126) values.push(c - 32);
  }

  // The check digit is a weighted sum: the start symbol counts once, then each
  // data symbol is weighted by its 1-based position. Mod 103.
  let sum = START_B;
  values.forEach((v, i) => {
    sum += v * (i + 1);
  });
  const check = sum % 103;

  const symbols = [
    PATTERNS[START_B],
    ...values.map((v) => PATTERNS[v]),
    PATTERNS[check],
    STOP,
  ];

  const elements: BarcodeElement[] = [];
  let modules = 0;

  for (const symbol of symbols) {
    // Every symbol starts on a bar and alternates from there.
    let bar = true;
    for (const digit of symbol) {
      const width = Number(digit);
      elements.push({ width, bar });
      modules += width;
      bar = !bar;
    }
  }

  return { elements, modules };
}

/**
 * The bars only, as `[offset, width]` pairs in module units.
 *
 * Both renderers take this: the SVG on the page and the canvas that draws the
 * downloadable PNG. They share it precisely so the printed ticket and the
 * screen ticket cannot end up encoding different things.
 */
export function barcodeBars(text: string): {
  bars: { x: number; width: number }[];
  modules: number;
} {
  const { elements, modules } = code128(text);
  const bars: { x: number; width: number }[] = [];

  let x = 0;
  for (const el of elements) {
    if (el.bar) bars.push({ x, width: el.width });
    x += el.width;
  }

  return { bars, modules };
}

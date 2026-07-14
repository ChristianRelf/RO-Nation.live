import {
  Anton,
  Archivo,
  Cormorant_Garamond,
  JetBrains_Mono,
} from "next/font/google";
import localFont from "next/font/local";

// Every brand's faces, and the class string that activates one.
//
// next/font is resolved at build time - you cannot pick a face from a runtime
// string - so all of them are imported here and chosen by slug.
//
// The class string goes on <html>, never on a wrapper <div>, and this is the
// subtle one. `var()` substitutes at the element where the property is
// declared: `body { font-family: var(--font-sans) }` computes at body, and
// descendants inherit the already-substituted value. Declare the font variables
// below body and elements explicitly classed font-display / font-sans / .display
// would re-substitute and pick up the partner's face, while un-classed body copy
// silently stayed on Archivo - a bug that looks correct on every page you happen
// to spot-check.
//
// Partner faces MUST be declared with `preload: false`. Next preloads the fonts
// a route's *layout tree* declares, and these are declared in the root layout -
// so without it, every RNL page would emit a <link rel=preload> for a partner's
// fonts. Their @font-face rules still land in the global stylesheet (a few
// hundred bytes), but no font file is fetched unless a rule actually matches,
// so an RNL visitor downloads nothing extra.

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const RNL_FONTS = `${archivo.variable} ${anton.variable} ${jetbrains.variable}`;

// ---- Sleep Token's display face ---------------------------------------------
//
// Roabla: the partner's own face, a decorative display type, self-hosted from
// public/brand/sleeptokenro/. next/font/local hashes it into /_next/static/media and
// generates the @font-face, so it is subject to the same preload rule as every other
// partner face below.
//
// *** IT HAS NO DIGITS. ***
//
// Not a guess - the file's cmap maps 315 glyphs and 0-9 are not among them. That is
// normal for a "Demo Version" release and it is the single most important fact about
// using it, because a missing glyph does not fail loudly: the browser silently falls
// back CHARACTER BY CHARACTER. Set this face alone on a heading and "RITE II 2025"
// renders the letters in Roabla and "2025" in whatever the browser picks - two
// typefaces inside one line, which reads as a bug rather than as a choice.
//
// So it is CHAINED, not substituted. Cormorant sits behind it and picks up the digits
// (see --font-display in styles/brands/sleeptokenro.css). Cormorant was the display face
// here already, so the numerals land in the type this brand was drawn around rather than
// in Times New Roman.
const roabla = localFont({
  src: "../../../public/brand/sleeptokenro/RoablaDemoVersionRegular-yYjVe.otf",
  variable: "--font-roabla",
  display: "swap",
  preload: false,
  // MUST be false, and this is the whole reason the digit chain works.
  //
  // By default next/font synthesises an extra "fallback" family - a metric-adjusted
  // local Arial - and splices it into the stack IMMEDIATELY AFTER this font, to hold
  // the layout steady while the real face loads. That is a good default and it is
  // exactly wrong here: Arial has digits, so when the browser hits a numeral Roabla
  // cannot draw, it stops at the adjusted Arial and NEVER REACHES CORMORANT. The
  // numerals come out in a geometric sans in the middle of a garamond heading, and
  // Cormorant is not even downloaded.
  //
  // Verified, not assumed: with this left on, "RITE II · 2025" rendered its letters in
  // Roabla and its year in Arial.
  adjustFontFallback: false,
});

// Kept, and no longer the display face itself: it is the numeral face, and the fallback
// if Roabla ever fails to load. A high-contrast, light-weight garamond.
//
// preload: false is required, not stylistic - see the note above.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-cormorant",
  display: "swap",
  preload: false,
});

/**
 * Partner font stacks, by slug. Each must supply all three variables - a brand
 * that omits --font-display would fall back to Impact, not to Anton.
 *
 * Sleep Token supplies FOUR faces, and --font-display is not one of them: it is
 * composed from --font-roabla and --font-cormorant in the brand stylesheet, because a
 * CSS variable is the only place a font STACK can be expressed. See that file.
 *
 * Note what stays: --font-sans is still Archivo and --font-mono is still JetBrains.
 * Roabla cannot take them and it is not a close call - body copy and mono data are
 * where the digits live (prices, catalog ids, dates, ticket codes), and the disclaimer
 * this brand is legally leaning on is body copy that sleeptokenro.css says in as many
 * words must never be made harder to read.
 */
const BRAND_FONTS: Record<string, string> = {
  sleeptokenro: `${archivo.variable} ${roabla.variable} ${cormorant.variable} ${jetbrains.variable}`,
};

export function fontClassFor(slug: string | null | undefined) {
  return (slug && BRAND_FONTS[slug]) || RNL_FONTS;
}

import {
  Anton,
  Archivo,
  Cormorant_Garamond,
  JetBrains_Mono,
} from "next/font/google";

// Every brand's faces, and the class string that activates one.
//
// next/font is resolved at build time — you cannot pick a face from a runtime
// string — so all of them are imported here and chosen by slug.
//
// The class string goes on <html>, never on a wrapper <div>, and this is the
// subtle one. `var()` substitutes at the element where the property is
// declared: `body { font-family: var(--font-sans) }` computes at body, and
// descendants inherit the already-substituted value. Declare the font variables
// below body and elements explicitly classed font-display / font-sans / .display
// would re-substitute and pick up the partner's face, while un-classed body copy
// silently stayed on Archivo — a bug that looks correct on every page you happen
// to spot-check.
//
// Partner faces MUST be declared with `preload: false`. Next preloads the fonts
// a route's *layout tree* declares, and these are declared in the root layout —
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

// Sleep Token's display face. A high-contrast, light-weight garamond —
// against RNL's Anton it reads as the opposite instinct entirely, which is the
// point: a partner should not look like RNL wearing a different colour.
//
// preload: false is required, not stylistic — see the note above.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-display",
  display: "swap",
  preload: false,
});

/**
 * Partner font stacks, by slug. Each must supply all three variables — a brand
 * that omits --font-display would fall back to Impact, not to Anton.
 */
const BRAND_FONTS: Record<string, string> = {
  sleeptokenro: `${archivo.variable} ${cormorant.variable} ${jetbrains.variable}`,
};

export function fontClassFor(slug: string | null | undefined) {
  return (slug && BRAND_FONTS[slug]) || RNL_FONTS;
}

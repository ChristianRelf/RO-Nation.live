// The merch collections.
//
// A collection is a themed shelf in the shop: merch.ronation.live/sleeptoken,
// /babymetal. It owns the page's copy, its artwork, and - the load-bearing part -
// which BRAND it renders in.
//
// This module is *pure data* for exactly the reason lib/partners/registry.ts is,
// and the reason is not stylistic. The middleware has to know, from the URL alone
// and before anything has touched a database, which brand a request paints in: it
// sets `data-brand` on the request, the root layout puts it on <html>, and `body {
// background-color: var(--bg) }` resolves there. Middleware runs on the edge, where
// Prisma cannot. So a collection cannot be a row - it has to be here.
//
// PRODUCTS are rows (MerchProduct), because the edge never needs to know one
// exists. The split is not arbitrary: it is exactly the line between what the
// middleware must answer and what it must not.
//
// Nothing here grants anything. The shop is public.

import { PARTNERS } from "@/lib/partners/registry";

export type Collection = {
  /** The URL segment, and the whole of it: merch.ronation.live/<slug>. */
  slug: string;
  name: string;
  /** One line, under the name, on the collection's own page. */
  tagline: string;
  description: string;
  /**
   * A PARTNER slug - and so the collection borrows that partner's entire visual
   * identity: palette, fonts, the lot. `sleeptoken` → `sleeptokenro`, and the
   * Sleep Token shelf comes out in Sleep Token's bone-and-gold rather than RNL's
   * blue, with no new stylesheet and no new font import.
   *
   * The two names differ on purpose. The partner's slug is a subdomain and reads
   * like one; the collection's is a URL people type. They are not required to
   * match and should not be assumed to.
   *
   * Validated against PARTNERS below, because a typo here does not break - it
   * quietly serves the collection in RNL's colours, which looks like a design
   * choice rather than a bug.
   */
  brand?: string;
  /** Behind the collection header. A path under /public, or an /uploads/… image. */
  heroImageUrl?: string;
  /**
   * The small print, and for a tribute or parody collection it is not optional.
   *
   * The same reasoning as a partner site's disclaimer (see the note on the field in
   * partners/registry.ts): this merch names a real band, it is sold on an RNL
   * domain with RNL's name under it, and an ambiguous shelf is RNL's problem. Say
   * plainly that the act is not involved.
   */
  disclaimer?: string;
  active: boolean;
};

export const COLLECTIONS: readonly Collection[] = [
  {
    slug: "babymetal",
    name: "BABYMETAL",
    tagline: "Fox God tour merch, for your Roblox avatar",
    description:
      "Classic Roblox shirts from RO. Nation LIVE's BABYMETAL tribute shows. Buy them on Roblox and wear them in any experience.",
    // Not optional. BABYMETAL are a real band who have nothing to do with this,
    // the shirts are sold from an RNL group, and the shop sits on an RNL domain.
    disclaimer:
      "Fan-made tribute merchandise from RO. Nation LIVE. Not affiliated with, endorsed by, or connected to BABYMETAL, their management or their label. No official artwork is used.",
    active: true,
  },
  {
    slug: "sleeptoken",
    name: "Sleep Token",
    tagline: "Worship in your own skin",
    description:
      "Merch from the Sleep Token Roblox tribute shows - the fan-run event series produced with RO. Nation LIVE.",
    // Borrows the partner's palette and Cormorant display face. The partner's own
    // disclaimer explains the event series; this one has to stand on its own,
    // because a shopper may never have seen their site.
    brand: "sleeptokenro",
    disclaimer:
      "Fan-made tribute merchandise. Sleep Token is an unofficial, fan-run Roblox event series, not affiliated with, endorsed by, or connected to the band Sleep Token, their management or their label. No official music, artwork or branding is used.",
    active: true,
  },
];

/** A URL segment: lowercase alphanumerics and inner hyphens. No dots - see below. */
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const seen = new Set<string>();
for (const c of COLLECTIONS) {
  // No dots, and the regex above already forbids them - but the reason is worth
  // writing down, because it is not obvious and it fails silently. The middleware's
  // matcher skips any path that looks like a file (`.*\.[\w]+$`), so a collection
  // slugged "tour.2024" would never reach the middleware at all: no rewrite, no
  // brand, a bare 404 on a URL that looks perfectly reasonable.
  if (!SLUG_RE.test(c.slug)) {
    throw new Error(`Collection slug "${c.slug}" is not a valid URL segment.`);
  }
  if (seen.has(c.slug)) {
    throw new Error(`Duplicate collection slug "${c.slug}".`);
  }
  seen.add(c.slug);

  // A brand that names no partner is the quiet failure this check exists for: the
  // page renders, in the wrong colours, and looks like somebody's taste rather than
  // a typo. Fail the build instead.
  if (c.brand && !PARTNERS.some((p) => p.slug === c.brand)) {
    throw new Error(
      `Collection "${c.slug}": brand "${c.brand}" is not a registered partner slug.`,
    );
  }
}

export function collectionBySlug(slug: string | null | undefined): Collection | null {
  if (!slug) return null;
  return COLLECTIONS.find((c) => c.slug === slug && c.active) ?? null;
}

/** The shelves the shop shows. */
export function activeCollections() {
  return COLLECTIONS.filter((c) => c.active);
}

/**
 * The brand a collection paints in - "" when it has none.
 *
 * Called by the middleware, so it must stay synchronous and free of imports that
 * cannot run on the edge.
 */
export function brandForCollection(slug: string | null | undefined) {
  return collectionBySlug(slug)?.brand ?? "";
}

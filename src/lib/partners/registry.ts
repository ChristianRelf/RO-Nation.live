// The partner registry.
//
// This module is the single source of truth for which partner sites exist. It
// is deliberately *pure data* — no prisma, no server-only imports, no env — for
// one hard reason: middleware runs on the edge, where Prisma cannot, and the
// middleware has to know from the Host header alone which brand a request
// belongs to. It is also why partner theming is config-in-code rather than
// rows in a table.
//
// Everything here is presentation and routing. Nothing here is authorization:
// membership of a partner, and the right to edit its content, is read from the
// database per request (see the partner guard). A slug in this file grants
// nobody anything.

export type PartnerFeature = "events" | "blog" | "careers" | "surveys";

export type Partner = {
  /** The subdomain, the DB `Partner.slug`, and the `data-brand` value — one string, three jobs. */
  slug: string;
  name: string;
  /** Ticket codes read `ST-XXXXXX`. Keep it short and unmistakable. */
  ticketPrefix: string;
  /** Which of the shared features this partner gets. A missing one must 404, not just hide its nav item. */
  features: readonly PartnerFeature[];
  /** The browser chrome colour. The one colour TS has to know — it duplicates --bg, which is unavoidable: `viewport` is a JS export. */
  themeColor: string;
  /** Confetti is drawn to a <canvas>, so it can't read a CSS variable. It is the one visual value that genuinely belongs here. */
  confetti: readonly string[];
  active: boolean;
};

/**
 * Registered partners. Empty until a partner actually ships — every partner
 * code path is dead while this list is, which is what makes Phase 1 safe to
 * merge on its own.
 *
 * Adding one here does NOT create it: it also needs a DB row, a brand
 * stylesheet at src/styles/brands/<slug>.css, an entry in fonts.ts, and a host
 * in the Caddyfile (added only once DNS resolves — Caddy asks Let's Encrypt for
 * a certificate the moment you reload it).
 */
export const PARTNERS: readonly Partner[] = [];

/**
 * Names a partner slug may never take.
 *
 * A partner is served internally from /p/<slug>, so a slug can't actually
 * collide with a top-level route — but the slug is also a subdomain, and
 * portal.ronation.live/<slug> is the partner's portal. Both of those namespaces
 * are shared with RNL's own. Checked at module load, so a bad slug fails the
 * build rather than quietly shadowing a real route.
 */
const RESERVED = new Set([
  // hosts + internal prefixes
  "www",
  "ronation",
  "portal",
  "survey",
  "api",
  "p",
  "pp",
  // every existing top-level route
  "events",
  "blog",
  "careers",
  "tickets",
  "account",
  "admin",
  "studio",
  "shasha",
  "legal",
  "about",
  "team",
  "faq",
  "contact",
  "partners",
]);

/** A DNS label: lowercase alphanumerics and inner hyphens. */
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const seen = new Set<string>();
for (const p of PARTNERS) {
  if (!SLUG_RE.test(p.slug)) {
    throw new Error(`Partner slug "${p.slug}" is not a valid subdomain label.`);
  }
  if (RESERVED.has(p.slug)) {
    throw new Error(`Partner slug "${p.slug}" is reserved by RO. Nation LIVE.`);
  }
  if (seen.has(p.slug)) {
    throw new Error(`Duplicate partner slug "${p.slug}".`);
  }
  seen.add(p.slug);
}

export function partnerBySlug(slug: string | null | undefined): Partner | null {
  if (!slug) return null;
  return PARTNERS.find((p) => p.slug === slug && p.active) ?? null;
}

/**
 * "sleeptokenro.ronation.live" → the Sleep Token partner.
 *
 * Matches on the first label, so it works unchanged for `<slug>.localhost` in
 * dev. A host with no subdomain (ronation.live) has no partner.
 */
export function partnerByHost(host: string | null | undefined): Partner | null {
  if (!host) return null;
  const h = host.split(":")[0].toLowerCase();
  const label = h.split(".")[0];
  if (!label || label === h) return null;
  return partnerBySlug(label);
}

export function partnerHasFeature(partner: Partner, feature: PartnerFeature) {
  return partner.features.includes(feature);
}

/** Live partner sites, for the public partners page. */
export function activePartners() {
  return PARTNERS.filter((p) => p.active);
}

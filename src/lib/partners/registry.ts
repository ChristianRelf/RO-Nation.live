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
  /** The subdomain, the `partnerId` scope column, and the `data-brand` value — one string, three jobs. */
  slug: string;
  name: string;
  /** Shown where `name` is too long to sit on one line — nav, footer, ticket stubs. */
  shortName: string;
  tagline: string;
  description: string;
  /**
   * The small-print line under the partner's footer, above the RNL credit.
   *
   * A partner that runs tribute or fan events for a real-world act MUST carry
   * one. These sites live on an RNL subdomain with RNL's name in the footer, so
   * an ambiguous one is RNL's problem as much as the partner's: say plainly
   * that this is a Roblox event series and that the act is not involved.
   */
  disclaimer?: string;
  /** Ticket codes read `ST-XXXXXX`. Keep it short and unmistakable. */
  ticketPrefix: string;
  /**
   * The wordmark printed on the ticket's issuer bar. Optional.
   *
   * It must be WHITE (or very light) with a transparent background: that bar is
   * near-black on every brand, and a dark logo would vanish into it. A path under
   * /public, or an uploaded /uploads/… image.
   *
   * Leave it out and the ticket falls back to the lettered badge plus the name in
   * type, which is what a partner with no artwork gets — and looks deliberate
   * rather than unfinished. See lib/tickets/brand.ts.
   */
  logoUrl?: string;
  /** Which of the shared features this partner gets. A missing one must 404, not just hide its nav item. */
  features: readonly PartnerFeature[];
  /**
   * May this partner price tickets in Robux?
   *
   * This is the SECOND key, not the switch. Paid ticketing is off globally
   * (ROBUX_TICKETS_ENABLED, default false) because Robux cannot be charged from
   * a website at all — a real payment happens inside the Roblox experience, via
   * a Developer Product and a ProcessReceipt handler that does not exist yet.
   * Until it does, a paid ticket could be sold and never honoured.
   *
   * So this flag on its own sells nothing. It records which partners have agreed
   * to take money, so that the day the master switch flips, it flips only for
   * them — and not for every partner who happened to be in this file. See
   * robuxSalesAllowed() in lib/tickets/pricing.ts, which needs both.
   */
  robuxTickets?: boolean;
  /**
   * The partner's public Roblox group, linked from their site. Presentation
   * only — it grants NOTHING.
   *
   * Portal access is the PartnerMember rows RNL grants, and deliberately not a
   * rank in here: SHASHA can say "the group IS the allowlist" because RNL owns
   * that group, but RNL does not own this one. Ranking off it would hand a
   * partner the power to grant access to RNL's infrastructure by promoting
   * someone in a group RNL cannot see or control.
   */
  robloxGroupUrl?: string;
  /** The browser chrome colour. The one colour TS has to know — it duplicates --bg, which is unavoidable: `viewport` is a JS export. */
  themeColor: string;
  /** Confetti is drawn to a <canvas>, so it can't read a CSS variable. It is the one visual value that genuinely belongs here. */
  confetti: readonly string[];
  active: boolean;
};

/**
 * Registered partners.
 *
 * Adding one here does NOT finish the job: it also needs PartnerMember rows (so
 * somebody can actually sign in to its portal), a brand stylesheet at
 * src/styles/brands/<slug>.css, an entry in fonts.ts, and a host in the
 * Caddyfile (added only once DNS resolves — Caddy asks Let's Encrypt for a
 * certificate the moment you reload it).
 */
export const PARTNERS: readonly Partner[] = [
  {
    slug: "sleeptokenro",
    name: "Sleep Token RO",
    shortName: "STRO",
    tagline: "Roblox tribute shows",
    description:
      "Sleep Token RO stages tribute shows inside Roblox — full production, live crowd, free tickets. A fan project, built by fans, produced with RO. Nation LIVE.",
    // This one is not optional. The name references a real band who have nothing
    // to do with this, the site sits on an RNL subdomain, and RNL's name is in
    // the footer — so the page has to say what it is, in plain words, without
    // being hunted for.
    disclaimer:
      "Sleep Token RO is an unofficial, fan-run Roblox event series. It is not affiliated with, endorsed by, or connected to the band Sleep Token, their management or their label. No official music, artwork or branding is used.",
    ticketPrefix: "ST",
    // Shows, their own blog, and their own crew applications. Not surveys —
    // survey.ronation.live is still RNL-global and has no partner scope yet, so
    // switching it on here would hand them a feature that does not exist.
    features: ["events", "blog", "careers"],
    // Sleep Token RO want paid VIP tiers alongside free general admission. This
    // says they are allowed to price them; it does not put any on sale. The
    // master switch is off, so their paid tiers render locked and the reserve
    // action refuses them. Nothing is charged to anybody today.
    robuxTickets: true,
    themeColor: "#0a0908",
    // Bone and dim gold — the brand's own accent, matched to the palette below.
    confetti: ["#b09254", "#d8c9a8", "#8e7742", "#ece9e1"],
    active: true,
  },
];

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
  "company",
  "uploads",
  "shasha",
  "legal",
  "about",
  "team",
  "faq",
  "contact",
  "partners",
  // Gone, but still reserved: both redirect into /company, and a partner slug
  // that shadowed one would swallow the redirect for everybody.
  "admin",
  "studio",
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

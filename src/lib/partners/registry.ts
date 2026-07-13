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
  /**
   * The big emblem the homepage hero is built around. Optional, and the page is
   * designed to be right without it.
   *
   * It is drawn ENORMOUS and dim, behind the type, bled off the edges — so it
   * wants to be a single centred device (a crest, a seal, a sigil) on a
   * transparent background, not a photograph and not a lockup with words in it.
   * Type set over its own wordmark is a mess at any opacity.
   *
   * A partner's editable `heroImageUrl` (PartnerContent, set in their studio)
   * overrides this when present — the registry is the default, the studio is the
   * override, so a partner can put a poster behind the hero for one tour without
   * a deploy.
   */
  crestUrl?: string;
  /**
   * The stand-in image for a show this partner hasn't made a poster for yet.
   *
   * Not cosmetic. The shared EventCard's default is RNL's placeholder — electric
   * blue, with RNL's own wordmark across it — so a partner who leaves this unset
   * gets a shows page with somebody else's name printed over every one of their
   * events. Set it for any partner whose brand is not RNL's.
   */
  eventPlaceholderUrl?: string;
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
   * only — it grants NOTHING. `governance` below is what grants.
   */
  robloxGroupUrl?: string;
  /**
   * Let this partner run their OWN portal access off their OWN Roblox group.
   *
   * Off by default, and that default is the careful one. Portal access is normally
   * PartnerMember rows that RNL grants and RNL revokes, precisely because RNL does
   * not own a partner's group: turning this on hands the partner's own group admins
   * the power to grant access to RNL infrastructure by promoting somebody, and RNL
   * cannot see it happen. That is a real transfer of trust, and it should be a
   * decision somebody makes on purpose, per partner — which is why it is a field
   * here rather than a rank in env.ts.
   *
   * What it CANNOT do is take access away. Rank tops the member rows UP; the rows
   * are the floor (see lib/partners/guard.ts). So a partner cannot lock RNL out of
   * their portal by demoting people in a group RNL does not control, and RNL's own
   * 250+ override still opens every partner portal regardless of any of this.
   *
   *   staffRank    read the portal — the lists, the door.
   *   managerRank  write: edit the roster, the studio, and mint API keys.
   *
   * Roblox ranks run 0–255 (owner is always 255), so the owner always clears both.
   */
  governance?: {
    /** THEIR group, not RNL's. Numeric id, as a string. */
    groupId: string;
    /** Rank at or above this reads the portal. */
    staffRank: number;
    /** Rank at or above this writes. Must be >= staffRank. */
    managerRank: number;
  };
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
    // The band's own marks, used with the permission the partner holds. They are
    // the reason the disclaimer above is now load-bearing rather than a
    // formality: a site carrying the real wings and the real crest is one a
    // visitor could mistake for the band's own, and the disclaimer is the only
    // thing that stops them. It is rendered plainly on every page — see
    // components/partner/partner-footer.tsx. Do not shrink it, grey it out, or
    // move it below the fold.
    //
    // `mark` is gold on transparent, which is why it works on the ticket's issuer
    // bar (near-black on every brand) without a white variant.
    logoUrl: "/brand/sleeptokenro/mark.png",
    crestUrl: "/brand/sleeptokenro/crest.png",
    eventPlaceholderUrl: "/brand/sleeptokenro/event-placeholder.svg",
    // Sleep Token RO run their own crew out of their own group, so their portal
    // ranks off it rather than off a member row per person. RNL still holds the
    // floor (PartnerMember rows) and the 250+ override — see the note on
    // `governance` above for exactly what this does and does not hand over.
    governance: {
      groupId: "636922593",
      staffRank: 249, // 249+ — read the lists, work the door
      managerRank: 253, // 253+ — write, and mint API keys
    },
    robloxGroupUrl: "https://www.roblox.com/communities/636922593",
    // Shows, their own blog, and their own crew applications. Not surveys —
    // survey.ronation.live is still RNL-global and has no partner scope yet, so
    // switching it on here would hand them a feature that does not exist.
    features: ["events", "blog", "careers"],
    // Sleep Token RO want paid VIP tiers alongside free general admission. This
    // says they are allowed to price them; it does not put any on sale. The
    // master switch is off, so their paid tiers render locked and the reserve
    // action refuses them. Nothing is charged to anybody today.
    robuxTickets: true,
    // Duplicates --bg-rgb in styles/brands/sleeptokenro.css by necessity — the
    // browser chrome colour is a JS export and cannot read a CSS variable. If one
    // moves, move the other.
    themeColor: "#060605",
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
  // The API docs on the portal host. The middleware tries the partner rewrite
  // BEFORE it checks PORTAL_PATHS, so a partner slugged "docs" would swallow
  // portal.ronation.live/docs outright.
  "docs",
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

  // Governance is an access-control grant, so a typo in it is a security bug, not
  // a rendering one. Fail the BUILD rather than the request: a managerRank below
  // staffRank would silently promote every reader to a writer, and nothing about
  // the running site would look wrong until somebody used it.
  const gov = p.governance;
  if (gov) {
    if (!/^\d+$/.test(gov.groupId)) {
      throw new Error(`Partner "${p.slug}": governance.groupId must be numeric.`);
    }
    if (gov.managerRank < gov.staffRank) {
      throw new Error(
        `Partner "${p.slug}": governance.managerRank (${gov.managerRank}) is below ` +
          `staffRank (${gov.staffRank}) — that would make every reader a writer.`,
      );
    }
    for (const [name, rank] of [
      ["staffRank", gov.staffRank],
      ["managerRank", gov.managerRank],
    ] as const) {
      if (!Number.isInteger(rank) || rank < 1 || rank > 255) {
        throw new Error(
          `Partner "${p.slug}": governance.${name} must be 1–255 (Roblox ranks; 0 is "not in the group").`,
        );
      }
    }
  }
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

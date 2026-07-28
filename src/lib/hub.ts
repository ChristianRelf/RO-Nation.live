import "server-only";
import { env } from "./env";
import { getUserSession } from "./session";
import { getCompanyAccess } from "./company";
import { getPortalAccess } from "./shasha";
import { getPartnerAccess } from "./partners/guard";
import { getDocsReader } from "./docs-guard";
import { activePartners } from "./partners/registry";
import { partnerOrigin, partnerPortalPath } from "./partners/urls";
import { accountsOrigin } from "./accounting/urls";

// What the backstage HUB shows you: every door you personally hold, and nothing else.
//
// portal.ronation.live used to be a set of URLs you had to already know. If you worked
// the SHASHA list AND a partner's, the only way between them was to retype the address -
// there was no page that said "here is everything you can open". This is that page's data.
//
// ---- One rule: this asks the real guards, it does not reinvent them --------
//
// Every area below is decided by the SAME function that guards the area itself -
// getCompanyAccess (lib/company.ts), getPortalAccess (lib/shasha.ts), getPartnerAccess
// (lib/partners/guard.ts). So the hub can never offer a door that then bounces you, and -
// the direction that actually matters - it can never omit a door you hold. It is a VIEW of
// authorization, never a second copy of it. The pages still guard themselves; a link here
// is a convenience, not a grant.
//
// The rank lookups behind those guards all share lib/roblox-group's five-minute cache, so
// asking every guard on one page load is a handful of cache hits, not a storm of requests.

export type HubLink = { label: string; href: string; external?: boolean };

export type HubArea = {
  /** Stable id: "company", "shasha", or a partner slug. */
  id: string;
  kind: "company" | "shasha" | "partner";
  name: string;
  /** "Owner", "Management", "Read only", "Manager · rank 250"… - what you are HERE. */
  roleLabel: string;
  /** Drives the accent treatment on the badge, exactly like PortalNav. */
  canWrite: boolean;
  blurb: string;
  /** The card's primary destination. */
  home: HubLink;
  /** The tools inside, already filtered to the ones this person can actually use. */
  links: HubLink[];
};

export type HubData = {
  /** Null when signed out - the page shows a sign-in prompt instead of empty areas. */
  session: { displayName: string; avatarUrl?: string } | null;
  areas: HubArea[];
  quickLinks: HubLink[];
  /** "Sign in with Roblox", returning here afterwards. */
  signInHref: string;
};

/** One entry in the portal nav's org switcher - an area, reduced to its front door. */
export type SwitcherArea = {
  id: string;
  kind: HubArea["kind"];
  name: string;
  roleLabel: string;
  canWrite: boolean;
  href: string;
  external?: boolean;
};

/**
 * The areas, for the switcher in PortalNav's brand slot.
 *
 * Crossing from Sleep Token's portal to SHASHA used to mean going up to /hub and
 * back down again, because the nav is built from ONE basePath and knows nothing
 * about the others. This is that missing list.
 *
 * It is deliberately getHubData() and not a cheaper bespoke query: the whole point
 * of the hub's design is that one function decides what you may open, by asking the
 * real guards. A second, faster path to the same answer is exactly how the two
 * would eventually disagree - and the direction that would hurt is a switcher
 * offering a door that then bounces you.
 *
 * It is just as deliberately NOT getHubDashboard() (lib/hub-dashboard.ts). That
 * function is this one plus around eight aggregates - next show, tickets sold,
 * roster counts, drafts, key health, the activity feed - and it exists because the
 * hub wants them and no other page does. THIS function runs inside PortalNav, on
 * every SHASHA and every partner page load. Reaching for the richer one here
 * because it "has everything" would put a capacity meter's groupBy in the path of
 * somebody opening a blacklist at a door, on a laptop, mid-queue.
 *
 * The split between them is DATA, never authorization: the dashboard decorates the
 * areas this returns and has no way to add one.
 */
export async function getPortalSwitcher(): Promise<SwitcherArea[]> {
  const { areas } = await getHubData();
  return areas.map((a) => ({
    id: a.id,
    kind: a.kind,
    name: a.name,
    roleLabel: a.roleLabel,
    canWrite: a.canWrite,
    href: a.home.href,
    external: a.home.external,
  }));
}

/** An absolute URL onto the MAIN site - /company lives on ronation.live, not the portal host. */
const main = (sub: string) => new URL(sub, env.siteUrl).toString();

const PARTNER_ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Management",
  STAFF: "Read only",
};

export async function getHubData(): Promise<HubData> {
  const session = await getUserSession();
  const signInHref = `/api/auth/roblox/login?returnTo=${encodeURIComponent("/hub")}`;

  if (!session) {
    return { session: null, areas: [], quickLinks: [], signInHref };
  }

  const areas: HubArea[] = [];

  // ---- RO. Nation LIVE's own dashboard (Company) - on the MAIN site --------
  const company = await getCompanyAccess();
  if (company.state === "allowed") {
    areas.push({
      id: "company",
      kind: "company",
      name: "RO. Nation LIVE",
      roleLabel: `${company.user.roleName} · rank ${company.user.rank}`,
      canWrite: true,
      blurb: "Everything on ronation.live: events, venues, the door, blog, surveys and the crew.",
      home: { label: "Open Company", href: main("/company"), external: true },
      links: [
        { label: "Events", href: main("/company/events"), external: true },
        { label: "Venues", href: main("/company/venues"), external: true },
        { label: "Door", href: main("/company/door"), external: true },
        { label: "Blog", href: main("/company/blog"), external: true },
        { label: "Surveys", href: main("/company/surveys"), external: true },
        { label: "Applications", href: main("/company/applications"), external: true },
        { label: "Enquiries", href: main("/company/enquiries"), external: true },
      ],
    });
  }

  // ---- SHASHA - RNL's own roster portal ------------------------------------
  const shasha = await getPortalAccess();
  if (shasha.state === "allowed") {
    const write = shasha.user.canWrite;
    areas.push({
      id: "shasha",
      kind: "shasha",
      name: "SHASHA",
      roleLabel: write ? "Management" : "Read only",
      canWrite: write,
      blurb: "RO. Nation LIVE's own VIP list and blacklist.",
      home: { label: "Open SHASHA", href: "/shasha" },
      links: [
        // RNL's own line-up and door, on the portal host rather than over on
        // /company. Both read tier, so they are offered to everybody who gets this
        // far - which is the point of them existing. Kept in the same order as
        // PortalNav's items so the hub card and the nav read as one thing.
        { label: "Shows", href: "/shasha/shows" },
        { label: "Door", href: "/shasha/door" },
        { label: "VIP list", href: "/shasha/vip" },
        { label: "Blacklist", href: "/shasha/blacklist" },
        { label: "History", href: "/shasha/audit" },
        // Managers only - the page refuses read-only staff, so a link that bounces
        // them would be worse than no link. Mirrors PortalNav's keysLink.
        ...(write ? [{ label: "API keys", href: "/shasha/keys" }] : []),
      ],
    });
  }

  // ---- Partner portals (Sleep Token, and any future partner) ---------------
  for (const partner of activePartners()) {
    const access = await getPartnerAccess(partner.slug);
    if (!access || access.state !== "allowed") continue;

    const u = access.user;
    const base = partnerPortalPath(partner.slug);
    const hasEvents = partner.features.includes("events");

    const links: HubLink[] = [
      { label: "VIP list", href: `${base}/vip` },
      { label: "Blacklist", href: `${base}/blacklist` },
      { label: "History", href: `${base}/audit` },
    ];
    // The same gating the partner portal's own nav uses (portal-nav.tsx + the portal
    // layout), so the hub offers exactly the doors that will actually open.
    if (hasEvents) links.push({ label: "Door", href: `${base}/door` });
    if (u.canWrite) links.push({ label: "Studio", href: `${base}/studio` });
    if (u.canWrite && hasEvents) links.push({ label: "API keys", href: `${base}/keys` });
    if (u.canManageMembers) links.push({ label: "Access", href: `${base}/members` });
    links.push({ label: "View site", href: partnerOrigin(partner.slug), external: true });

    areas.push({
      id: partner.slug,
      kind: "partner",
      name: partner.name,
      // RNL staff on the group override are HERE as RNL staff, not as one of the
      // partner's own people - say so, exactly as the partner guard distinguishes it.
      roleLabel: u.isRnlStaff ? "RNL staff" : PARTNER_ROLE_LABEL[u.role] ?? "Read only",
      canWrite: u.canWrite,
      blurb: partner.tagline,
      home: { label: `Open ${partner.shortName}`, href: base },
      links,
    });
  }

  // ---- Quick links: the shared destinations, not tied to one org -----------
  const quickLinks: HubLink[] = [];

  // The docs read tier is "anyone with a door anywhere" (docs-guard.ts), which is
  // exactly who is looking at this page with at least one area - but ask, don't assume,
  // because it also covers the API-reference sub-link's stricter test.
  const docs = await getDocsReader();
  if (docs) {
    quickLinks.push({ label: "Guides & brand assets", href: "/docs" });
    if (docs.canMintKeys) quickLinks.push({ label: "API reference", href: "/docs/api" });
  }

  // The staff payment system, on its own host. Offered on exactly the access that guards
  // it - getCompanyAccess is the same function app/accounts/layout.tsx calls - which is
  // the rule at the top of this file: a view of authorization, never a second copy.
  //
  // `external` because it is another origin. The chip renders it as a plain <a>, which is
  // what a cross-host link has to be; see the note on OutLink in
  // components/accounting/accounting-shell.tsx.
  if (company.state === "allowed") {
    quickLinks.push({
      label: "Accounts",
      href: accountsOrigin(),
      external: true,
    });
  }

  quickLinks.push({ label: "Main site", href: env.siteUrl, external: true });

  return {
    session: { displayName: session.displayName, avatarUrl: session.avatarUrl },
    areas,
    quickLinks,
    signInHref,
  };
}

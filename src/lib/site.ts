// Central place for brand + navigation config.

/**
 * The accounts RNL actually has.
 *
 * ---- Why this is a sparse record and not a fixed shape --------------------
 *
 * It used to be four fields, two of which were the strings `https://x.com/your-handle`
 * and `https://youtube.com/@your-channel`, above a comment saying "swap these for your
 * real links". Nobody ever did - and the footer rendered them as live, clickable X and
 * YouTube links on every page of the site. A visitor clicking either one landed on a
 * 404, on a placeholder somebody else owns, or on an account that has nothing to do with
 * RNL at all.
 *
 * So the type is `Partial`, the footer renders only the keys that are present, and a
 * social RNL does not have is simply ABSENT rather than fake. It is the same rule the
 * shop already follows - MerchStrip renders nothing rather than announce an empty shop -
 * applied to the one place on the site that was still breaking it.
 *
 * Adding a real account later is one line here. Nothing else has to change.
 */
export type Social = "discord" | "roblox" | "x" | "youtube" | "tiktok";

/** The label each one gets in the footer. Order is the order they render in. */
export const SOCIAL_LABELS: Record<Social, string> = {
  discord: "Discord",
  roblox: "Roblox group",
  x: "X / Twitter",
  youtube: "YouTube",
  tiktok: "TikTok",
};

/**
 * Discord and Roblox are REQUIRED; the rest are optional.
 *
 * Not pedantry. Half a dozen pages hang a real call to action off
 * `site.socials.discord` - "Join the Discord", "Partner with us on Discord" - and if that
 * key were merely optional, deleting it would compile, ship, and leave a button that says
 * "Join the Discord" and does nothing at all. Which is the same class of bug as the dead
 * X link, just quieter.
 *
 * So: the two RNL actually has are guaranteed to be strings. The ones it does not have
 * are absent, and the footer renders only what is here.
 */
type Socials = { discord: string; roblox: string } & Partial<
  Record<Social, string>
>;

const socials: Socials = {
  discord: "https://discord.gg/pxE7KRWgTY",
  roblox: "https://www.roblox.com/communities/33033115/RoNation-Live#!/about",
  // x: "https://x.com/…",              ← add when the account exists
  // youtube: "https://youtube.com/@…", ← add when the account exists
};

export const site = {
  name: "RO. Nation LIVE",
  shortName: "RO. Nation",
  tagline: "Roblox event management",
  description:
    "RO. Nation LIVE produces live shows, showcases and tournaments inside Roblox - from stage build to sold-out floor. Reserve tickets, join the crew.",

  socials,

  contactEmail: "hello@ronation.live",

  /**
   * The paragraph a journalist copies and pastes.
   *
   * Every claim in it is checkable against something on this site: RNL runs shows inside
   * Roblox, tickets are free and tied to a Roblox account, capacity is enforced at the
   * door through the in-experience API, and partners get their own site. There are no
   * numbers in it - the numbers live on /press and are COUNTED (lib/stats.ts), so they
   * cannot go stale and cannot be wrong.
   *
   * If you edit this, keep that property. A boilerplate with a figure in it is a figure
   * nobody will remember to update.
   */
  boilerplate:
    "RO. Nation LIVE is a Roblox event management group. It produces live shows, showcases and tournaments inside Roblox - building the venue, running the production and handling the ticketing end to end. Tickets are free and tied to a Roblox account, capacity is enforced at the door by in-experience verification rather than by screenshots, and partner groups can run their own branded site and box office on the same platform.",
};

export const nav = [
  { label: "Events", href: "/events" },
  // The shop lives on merch.ronation.live, and this is deliberately the RELATIVE path
  // rather than that absolute origin. The middleware already hands /merch over to the
  // merch host (src/middleware.ts), so one link works everywhere: on the live site it
  // redirects, and in local dev - where every host is served from one origin - it just
  // renders. An absolute URL here would be a second place for the host to be wrong.
  { label: "Merch", href: "/merch" },
  { label: "Blog", href: "/blog" },
  { label: "Careers", href: "/careers" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

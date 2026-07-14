// Central place for brand + navigation config. Swap socials/links here.

export const site = {
  name: "RO. Nation LIVE",
  shortName: "RO. Nation",
  tagline: "Roblox event management",
  description:
    "RO. Nation LIVE produces live shows, showcases and tournaments inside Roblox - from stage build to sold-out floor. Reserve tickets, join the crew.",
  // Placeholder socials - swap these for your real links.
  socials: {
    discord: "https://discord.gg/pxE7KRWgTY",
    roblox: "https://www.roblox.com/communities/33033115/RoNation-Live#!/about",
    x: "https://x.com/your-handle",
    youtube: "https://youtube.com/@your-channel",
  },
  contactEmail: "hello@ronation.live",
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

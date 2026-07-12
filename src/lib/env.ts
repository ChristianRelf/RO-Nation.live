// Centralised, typed access to environment configuration.

// The Roblox group everything ranks against — the Studio and the SHASHA portal
// are two doors into the same organisation. Either can be pointed at a
// different group, but they share one by default.
const GROUP_ID = process.env.ROBLOX_GROUP_ID || "34669403";

export const env = {
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000",
  authSecret: process.env.AUTH_SECRET || "dev-insecure-secret-change-me",
  admin: {
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "",
  },
  roblox: {
    clientId: process.env.ROBLOX_CLIENT_ID || "",
    clientSecret: process.env.ROBLOX_CLIENT_SECRET || "",
    authorizeUrl:
      process.env.ROBLOX_AUTHORIZE_URL ||
      "https://apis.roblox.com/oauth/v1/authorize",
    tokenUrl:
      process.env.ROBLOX_TOKEN_URL || "https://apis.roblox.com/oauth/v1/token",
    userinfoUrl:
      process.env.ROBLOX_USERINFO_URL ||
      "https://apis.roblox.com/oauth/v1/userinfo",
  },
  gameApiKey: process.env.GAME_API_KEY || "",
  allowDevLogin: process.env.ALLOW_DEV_LOGIN === "true",

  // ---- Paid ticketing (Robux) --------------------------------------
  // The master switch for selling tickets for Robux. OFF, and it must stay off
  // until the in-experience purchase pipeline exists.
  //
  // Robux cannot be charged from a website. A real payment is a Developer
  // Product prompted inside the Roblox experience, confirmed by a ProcessReceipt
  // handler on the game server calling back here. None of that is built. Ticket
  // *tiers* can already carry a Robux price — that is the option, and partners
  // can configure it today — but with this false, a priced tier renders locked at
  // checkout and app/actions/tickets.ts refuses to issue one. Both checks are
  // independent on purpose: the UI one is courtesy, the action one is the wall.
  //
  // Opt-in is deliberately "true" and nothing else, so an empty or missing value
  // can never read as on.
  robuxTickets: process.env.ROBUX_TICKETS_ENABLED === "true",

  // ---- Studio (/studio) -------------------------------------------
  // Members of this Roblox group at this rank or above can create and edit
  // events and blog posts on the main site, by signing in with Roblox.
  studio: {
    groupId: process.env.STUDIO_GROUP_ID || GROUP_ID,
    minRank: Number(process.env.STUDIO_MIN_RANK ?? 30),
  },

  // ---- SHASHA portal (portal.ronation.live/shasha) ----------------
  // Same Roblox group, two thresholds. Rank is read from Roblox on every
  // request, so a promotion or a demotion in the group IS the access change —
  // there is no list to keep in sync and nothing to revoke by hand.
  shasha: {
    groupId: process.env.SHASHA_GROUP_ID || GROUP_ID,
    /** Read the VIP list and the blacklist. */
    minRank: Number(process.env.SHASHA_MIN_RANK ?? 10),
    /** Add, edit and remove people. In SHA SHA Productions, 30 = Management. */
    managerRank: Number(process.env.SHASHA_MANAGER_RANK ?? 30),
  },
};

/** True when real Roblox OAuth credentials are configured. */
export const robloxConfigured = Boolean(
  env.roblox.clientId && env.roblox.clientSecret,
);

/** Dev mock login is only available when Roblox isn't configured and it's allowed. */
export const devLoginEnabled = env.allowDevLogin && !robloxConfigured;

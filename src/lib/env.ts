// Centralised, typed access to environment configuration.

// The Roblox group everything ranks against: RO. Nation LIVE.
// https://www.roblox.com/communities/33033115/RoNation-Live
//
// Every door into the organisation is a rank in this one group — /company, the
// SHASHA portal, and the override that opens every partner portal. There is no
// allowlist to maintain anywhere: promoting somebody IS the grant, demoting them
// IS the revocation, and rank is re-read from Roblox on every request (cached
// five minutes — see lib/roblox-group.ts). Each gate can be pointed at a
// different group if RNL ever splits, but they share one by default.
const GROUP_ID = process.env.ROBLOX_GROUP_ID || "33033115";

export const env = {
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000",
  authSecret: process.env.AUTH_SECRET || "dev-insecure-secret-change-me",
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

  // ---- The rank ladder ---------------------------------------------
  //
  // Three doors, one group, nested thresholds:
  //
  //   200+  SHASHA portal, read only — search the VIP list and the blacklist
  //   245+  SHASHA writes, AND /company: all of ronation.live
  //   250+  every partner portal and their studio, as an owner-equivalent
  //
  // The numbers nest deliberately: anyone who can open a partner's portal can
  // also run RNL's own site, and anyone who can write to SHASHA can read it.
  // Roblox ranks run 0–255 (guest 0, owner 255), so these sit at the top of the
  // ladder rather than in the middle of it.

  // ---- The Company (/company) --------------------------------------
  // RNL's own site: events, blog, surveys, careers, applications, attendees.
  // One door — the /admin password login this replaced is gone.
  company: {
    groupId: process.env.COMPANY_GROUP_ID || GROUP_ID,
    minRank: Number(process.env.COMPANY_MIN_RANK ?? 245),
  },

  // ---- Partner portals (portal.ronation.live/<slug>) ---------------
  // Normal access to a partner's portal is a PartnerMember row RNL grants them.
  // This is the OTHER way in: RNL staff at this rank hold owner-equivalent
  // access to EVERY partner, with no row and nothing to revoke by hand.
  //
  // It is the most powerful grant in the system — it reaches into organisations
  // RNL does not own — so it deliberately sits above /company rather than
  // alongside it. See the override in lib/partners/guard.ts.
  partners: {
    groupId: process.env.PARTNERS_GROUP_ID || GROUP_ID,
    staffRank: Number(process.env.PARTNER_STAFF_RANK ?? 250),
  },

  // ---- SHASHA portal (portal.ronation.live/shasha) ----------------
  shasha: {
    groupId: process.env.SHASHA_GROUP_ID || GROUP_ID,
    /** Read the VIP list and the blacklist. */
    minRank: Number(process.env.SHASHA_MIN_RANK ?? 200),
    /** Add, edit and remove people. */
    managerRank: Number(process.env.SHASHA_MANAGER_RANK ?? 245),
  },
};

/** True when real Roblox OAuth credentials are configured. */
export const robloxConfigured = Boolean(
  env.roblox.clientId && env.roblox.clientSecret,
);

/** Dev mock login is only available when Roblox isn't configured and it's allowed. */
export const devLoginEnabled = env.allowDevLogin && !robloxConfigured;

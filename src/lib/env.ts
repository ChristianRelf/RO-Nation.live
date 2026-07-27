// Centralised, typed access to environment configuration.

// The Roblox group everything ranks against: RO. Nation LIVE.
// https://www.roblox.com/communities/33033115/RoNation-Live
//
// Every door into the organisation is a rank in this one group - /company, the
// SHASHA portal, and the override that opens every partner portal. There is no
// allowlist to maintain anywhere: promoting somebody IS the grant, demoting them
// IS the revocation, and rank is re-read from Roblox on every request (cached
// five minutes - see lib/roblox-group.ts). Each gate can be pointed at a
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

  // ---- Notifications -----------------------------------------------
  // The Discord channel new applications, enquiries and ticket reservations are
  // pushed to. A webhook URL is a secret, so it lives in the environment, never in
  // the code registry. Absent → notifications silently no-op, which is the default
  // in dev and a safe default in prod. Per-partner overrides follow the
  // DISCORD_WEBHOOK_URL_<SLUG> convention and are resolved straight from
  // process.env in lib/notify.ts, because a partner slug cannot be a static key
  // here. See lib/notify.ts.
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || "",

  // The channel a SHOW is announced in when it goes PUBLISHED - and deliberately
  // a different variable from the one above, because it is a different audience.
  //
  // DISCORD_WEBHOOK_URL is an ops inbox: job applications, booking enquiries,
  // data-deletion requests, ticket reservations. It is somewhere private, and the
  // things that land in it are addressed to staff. A show announcement is the
  // opposite - it is written for the public ("doors at 19:00, tickets are free"),
  // and it belongs in whatever channel the members actually read.
  //
  // So there is NO fallback to discordWebhookUrl. Unset means show announcements
  // are off, exactly as an unset ops webhook means the inbox pings are off.
  // Wanting both in one channel is a supported thing to want: paste the same URL
  // into both variables, and it is then obvious from .env that you did.
  //
  // Per-partner overrides follow the same convention notify() already uses for
  // the inbox - DISCORD_ANNOUNCE_WEBHOOK_URL_<SLUG>, resolved from process.env in
  // lib/notify.ts. A partner's show is announced in the PARTNER's channel or not
  // at all; it never falls back to RNL's, because RNL's members did not follow a
  // partner's line-up. See webhookFor() there.
  discordAnnounceWebhookUrl: process.env.DISCORD_ANNOUNCE_WEBHOOK_URL || "",

  // ---- Paid ticketing (Robux) --------------------------------------
  //
  // THE MASTER SWITCH. May this site sell a ticket for Robux at all? Off by default.
  //
  // It is the first of the keys in lib/tickets/pricing.ts, and it is not the only one:
  // a partner additionally needs `robuxTickets` in the registry, so that flipping this
  // by itself cannot start charging a partner's visitors who never signed up for it.
  //
  // Ticket *tiers* can carry a Robux price whatever this says - that is the option, and
  // partners can configure it today. With this false, a priced tier renders locked at
  // checkout and lib/tickets/issue.ts refuses to issue one. Both checks are independent
  // on purpose: the UI one is courtesy, the one under the row lock is the wall.
  //
  // Opt-in is deliberately "true" and nothing else, so an empty or missing value can
  // never read as on.
  robuxTickets: process.env.ROBUX_TICKETS_ENABLED === "true",

  // THE GAME PASS KEY. A third switch, on top of the two above, guarding the one rail
  // that has a prerequisite outside this codebase.
  //
  // A game pass is bought on roblox.com in a browser, and afterwards we verify it by
  // asking Roblox's Open Cloud whether the buyer owns it - using THEIR OAuth grant. That
  // requires the Roblox OAuth application to be registered with the
  // `user.inventory-item:read` scope. (That is the only one. `offline_access` is NOT a
  // Roblox scope - refresh tokens come back on their own; see INVENTORY_SCOPES in
  // lib/roblox.ts, which used to ask for one that does not exist.)
  //
  // If it is not, the failure is the bad kind: the buyer goes to Roblox, pays real
  // Robux, comes back, and we cannot look. They are charged and they have no ticket.
  // Neither of the other two switches can possibly detect that, which is why this is a
  // key of its own rather than a line in one of them - and why it stays off until
  // somebody has actually been and configured the OAuth app.
  //
  // Off, the DEV PRODUCT rail still works; the web checkout simply does not offer to
  // sell anything. That is the failure you want.
  robuxGamePass: process.env.ROBUX_GAMEPASS_ENABLED === "true",

  // ---- The rank ladder ---------------------------------------------
  //
  // Three doors, one group, nested thresholds:
  //
  //   200+  SHASHA portal, read only - search the VIP list and the blacklist
  //   245+  SHASHA writes, AND /company: all of ronation.live
  //   250+  every partner portal and their studio, as an owner-equivalent
  //
  // The numbers nest deliberately: anyone who can open a partner's portal can
  // also run RNL's own site, and anyone who can write to SHASHA can read it.
  // Roblox ranks run 0–255 (guest 0, owner 255), so these sit at the top of the
  // ladder rather than in the middle of it.

  // ---- The Company (/company) --------------------------------------
  // RNL's own site: events, blog, surveys, careers, applications, attendees.
  // One door - the /admin password login this replaced is gone.
  company: {
    groupId: process.env.COMPANY_GROUP_ID || GROUP_ID,
    minRank: Number(process.env.COMPANY_MIN_RANK ?? 245),
  },

  // ---- Partner portals (portal.ronation.live/<slug>) ---------------
  // Normal access to a partner's portal is a PartnerMember row RNL grants them.
  // This is the OTHER way in: RNL staff at this rank hold owner-equivalent
  // access to EVERY partner, with no row and nothing to revoke by hand.
  //
  // It is the most powerful grant in the system - it reaches into organisations
  // RNL does not own - so it deliberately sits above /company rather than
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

  // ---- The merch shop (merch.ronation.live) ------------------------
  // The group whose STORE the shop lists. The same group as the one above today,
  // and still its own entry rather than a reuse of `company.groupId` - because the
  // two mean entirely different things and only coincidentally share a number.
  //
  // Every other groupId here answers "what rank does this person hold?" and is a
  // security boundary. This one answers "whose shop are we showing?" and grants
  // nothing whatsoever: point it at a group RNL does not own and the worst that
  // happens is the shop lists somebody else's shirts. If RNL ever moves its store
  // to a second group, this is the one line that moves - and nobody has to work out
  // whether changing it also hands out staff access.
  merch: {
    groupId: process.env.MERCH_GROUP_ID || GROUP_ID,
  },
};

/** True when real Roblox OAuth credentials are configured. */
export const robloxConfigured = Boolean(
  env.roblox.clientId && env.roblox.clientSecret,
);

/** Dev mock login is only available when Roblox isn't configured and it's allowed. */
export const devLoginEnabled = env.allowDevLogin && !robloxConfigured;

// Centralised, typed access to environment configuration.

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

  // ---- Studio (/studio) -------------------------------------------
  // Members of this Roblox group at this rank or above can create and edit
  // events and blog posts on the main site, by signing in with Roblox.
  studio: {
    groupId: process.env.STUDIO_GROUP_ID || "34669403",
    minRank: Number(process.env.STUDIO_MIN_RANK ?? 30),
  },

  // ---- SHASHA portal (portal.ronation.live/shasha) ----------------
  portal: {
    // Fallback origin only. Deliberately NOT a NEXT_PUBLIC_ var: those are
    // inlined at build time (empty in the Docker image), whereas the portal
    // needs a correct origin at runtime. The OAuth routes derive the origin
    // from the request instead — see portalOrigin() in lib/discord.ts.
    url: (process.env.PORTAL_URL || "").replace(/\/$/, ""),
  },
  discord: {
    clientId: process.env.DISCORD_CLIENT_ID || "",
    clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
    // Discord user IDs (snowflakes) allowed to write to the lists.
    managerIds: idList(process.env.DISCORD_MANAGER_IDS),
    // Discord user IDs allowed to sign in read-only. Managers are implicitly staff.
    staffIds: idList(process.env.DISCORD_STAFF_IDS),
  },
};

/** Parse a comma/space/newline separated list of Discord snowflakes. */
function idList(raw?: string) {
  return (raw || "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** True when real Roblox OAuth credentials are configured. */
export const robloxConfigured = Boolean(
  env.roblox.clientId && env.roblox.clientSecret,
);

/** Dev mock login is only available when Roblox isn't configured and it's allowed. */
export const devLoginEnabled = env.allowDevLogin && !robloxConfigured;

/** True when Discord OAuth credentials are configured for the portal. */
export const discordConfigured = Boolean(
  env.discord.clientId && env.discord.clientSecret,
);

/**
 * Access tiers for the portal, resolved fresh on every request from env — so
 * revoking someone is a config change, not a "wait for their cookie to expire".
 */
export function portalRole(discordId: string): "manager" | "staff" | null {
  if (env.discord.managerIds.includes(discordId)) return "manager";
  if (env.discord.staffIds.includes(discordId)) return "staff";
  return null;
}

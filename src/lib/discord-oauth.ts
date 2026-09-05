import "server-only";
import { env } from "./env";

// Discord OAuth 2.0 - the Authorization Code flow, `identify` scope only.
//
// This proves a member controls a real Discord account, in-browser. It writes to
// the SAME DiscordLink row as the bot-redeemed rotating code in lib/discord-link.ts;
// that flow exists for someone sitting in Discord who wants to link a Roblox
// account they are signed into elsewhere, this one is for someone sitting on the
// site who wants to link Discord without leaving it. Either one satisfies "has a
// verified Discord".
//
// No PKCE: unlike a public client, the token exchange below authenticates with
// `client_secret` (see exchangeCode), so a stolen `code` is useless without it.
// `state` alone is enough to stop the flow being started against somebody else -
// see the callback route.

export const REDIRECT_PATH = "/api/auth/discord/callback";

/**
 * The callback URL for the host the flow started on - same reasoning as
 * redirectUriFor() in lib/roblox.ts. Discord (unlike Roblox, see the note in
 * lib/env.ts) allows multiple redirect URIs on one application, so every host
 * that serves an apply form - ronation.live and each partner host - gets its
 * own entry in the Discord Developer Portal rather than a shared hop through
 * authorise.ronation.live.
 */
export function redirectUriFor(origin: string) {
  return `${origin}${REDIRECT_PATH}`;
}

export function randomString(length = 24) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Identity only - a Discord id and username. No email, no guilds, no messages. */
const SCOPES = ["identify"] as const;

export function buildAuthorizeUrl(params: { state: string; redirectUri: string }) {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", env.discordOAuth.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("state", params.state);
  return url.toString();
}

export type DiscordTokens = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
};

export async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<DiscordTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: env.discordOAuth.clientId,
    client_secret: env.discordOAuth.clientSecret,
  });

  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Discord token exchange failed: ${res.status}`);
  }
  return res.json();
}

export type DiscordUserInfo = {
  id: string; // Discord's own user id - the identity key, same role robloxId plays
  username: string;
  global_name: string | null; // the modern display name; falls back to username
};

export async function fetchUserInfo(
  accessToken: string,
): Promise<DiscordUserInfo> {
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Discord userinfo failed: ${res.status}`);
  }
  return res.json();
}

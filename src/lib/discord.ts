import "server-only";
import type { NextRequest } from "next/server";
import { env } from "./env";
import { randomString } from "./roblox";

// Discord OAuth 2.0 (Authorization Code flow) for the SHASHA staff portal.
// Only the `identify` scope is requested — we need the user's id, name and
// avatar, nothing else. Who may sign in is decided by the env allowlists.

export const REDIRECT_PATH = "/api/auth/discord/callback";

const AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const TOKEN_URL = "https://discord.com/api/oauth2/token";
const USERS_ME_URL = "https://discord.com/api/users/@me";

export { randomString };

const isLocalHost = (host: string) =>
  host.startsWith("localhost") ||
  host.startsWith("127.0.0.1") ||
  host.startsWith("[::1]") ||
  !host.includes(".");

/**
 * The origin the portal is actually being served from, taken from the request
 * so it stays correct behind a proxy and in the Docker image (where build-time
 * env inlining would otherwise bake in the wrong value).
 *
 * The scheme is *not* read from x-forwarded-proto: Next's own server sets that
 * header to "http" when nothing upstream overrides it, which would produce an
 * http:// redirect_uri that no longer matches the https one registered with
 * Discord. Any non-local host is therefore assumed to be behind TLS. Set
 * PORTAL_URL to override the whole thing.
 */
export function portalOrigin(req: NextRequest) {
  if (env.portal.url) return env.portal.url;

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!host) return env.siteUrl;

  return `${isLocalHost(host) ? "http" : "https"}://${host}`;
}

export function redirectUri(req: NextRequest) {
  return `${portalOrigin(req)}${REDIRECT_PATH}`;
}

export function buildAuthorizeUrl(params: { state: string; redirectUri: string }) {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", env.discord.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", params.state);
  url.searchParams.set("prompt", "none");
  return url.toString();
}

type DiscordTokens = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export async function exchangeCode(
  code: string,
  redirect: string,
): Promise<DiscordTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirect,
      client_id: env.discord.clientId,
      client_secret: env.discord.clientSecret,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Discord token exchange failed: ${res.status}`);
  }
  return res.json();
}

type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
};

export type DiscordProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
};

export async function fetchDiscordUser(
  accessToken: string,
): Promise<DiscordProfile> {
  const res = await fetch(USERS_ME_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Discord userinfo failed: ${res.status}`);
  }
  const user: DiscordUser = await res.json();

  return {
    id: user.id,
    username: user.username,
    displayName: user.global_name || user.username,
    avatarUrl: avatarUrl(user),
  };
}

function avatarUrl(user: DiscordUser) {
  if (user.avatar) {
    const ext = user.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=64`;
  }
  // Default avatar for users on the new username system.
  const index = Number((BigInt(user.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

import "server-only";
import { env } from "./env";

// Minimal Roblox OAuth 2.0 (OpenID Connect) helper using the Authorization
// Code flow with PKCE. Endpoints are configurable via env (see .env.example).

export const REDIRECT_PATH = "/api/auth/roblox/callback";

/**
 * The callback URL for the host the user is actually on.
 *
 * Sign-in has to work on survey.ronation.live as well as the main site, and the
 * session cookie it sets is scoped to whichever host issued it — so the round
 * trip must start and finish on the same origin. Every host used this way needs
 * its callback URL registered in the Roblox OAuth app.
 */
export function redirectUriFor(origin: string) {
  return `${origin}${REDIRECT_PATH}`;
}

export function redirectUri() {
  return redirectUriFor(env.siteUrl);
}

function base64url(bytes: Uint8Array) {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function randomString(length = 48) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

export async function pkceChallenge(verifier: string) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64url(new Uint8Array(digest));
}

export function buildAuthorizeUrl(params: {
  state: string;
  challenge: string;
  redirectUri?: string;
}) {
  const url = new URL(env.roblox.authorizeUrl);
  url.searchParams.set("client_id", env.roblox.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri ?? redirectUri());
  url.searchParams.set("scope", "openid profile");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export type RobloxTokens = {
  access_token: string;
  token_type: string;
  expires_in: number;
  id_token?: string;
};

export async function exchangeCode(
  code: string,
  verifier: string,
  redirect?: string,
): Promise<RobloxTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    // Must be byte-identical to the redirect_uri used at authorize time.
    redirect_uri: redirect ?? redirectUri(),
    client_id: env.roblox.clientId,
    client_secret: env.roblox.clientSecret,
    code_verifier: verifier,
  });

  const res = await fetch(env.roblox.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Roblox token exchange failed: ${res.status}`);
  }
  return res.json();
}

export type RobloxUserInfo = {
  sub: string; // roblox user id
  name?: string; // display name
  nickname?: string;
  preferred_username?: string; // username
  profile?: string;
  picture?: string; // avatar headshot url
};

export async function fetchUserInfo(
  accessToken: string,
): Promise<RobloxUserInfo> {
  const res = await fetch(env.roblox.userinfoUrl, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Roblox userinfo failed: ${res.status}`);
  }
  return res.json();
}

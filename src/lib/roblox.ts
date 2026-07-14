import "server-only";
import { env } from "./env";
import { partnerBySlug } from "./partners/registry";

// Minimal Roblox OAuth 2.0 (OpenID Connect) helper using the Authorization
// Code flow with PKCE. Endpoints are configurable via env (see .env.example).

export const REDIRECT_PATH = "/api/auth/roblox/callback";

/**
 * The callback URL for the host the user is actually on.
 *
 * Sign-in has to work on survey.ronation.live as well as the main site, and the
 * session cookie it sets is scoped to whichever host issued it - so the round
 * trip must start and finish on the same origin. Every host used this way needs
 * its callback URL registered in the Roblox OAuth app.
 */
export function redirectUriFor(origin: string) {
  return `${origin}${REDIRECT_PATH}`;
}

export function redirectUri() {
  return redirectUriFor(env.siteUrl);
}

/**
 * Where to send someone when sign-in fails, given where they were headed.
 *
 * It has to be a page that exists on the host they started on. The portal host
 * serves /shasha and bounces everything else to the main site, so sending a
 * failed SHASHA sign-in to /account would dump them on ronation.live with no
 * explanation of what went wrong.
 *
 * A partner adds a third case. On the portal host, a failed sign-in headed for
 * /sleeptokenro/vip belongs at /sleeptokenro/login - /account is not served
 * there either, so the default would strand them exactly the same way.
 *
 * The partner-site host is not a case: its paths are /events, /tickets and
 * /account, none of which can collide with a slug (the registry RESERVEs those
 * names), so a failure there falls through to /account - which on that host is
 * the partner's own sign-in page.
 */
export function failPath(returnTo: string) {
  // A sign-in that failed ON the front door. Its returnTo is the SSO authorize
  // URL it was going to resume, and none of the pages below exist on that host -
  // authorise.ronation.live serves one page, and it is the one that can explain
  // this. (The `to` origin is still in that URL, so the page can offer a way back
  // to where they started; see app/authorise/page.tsx.)
  if (returnTo.startsWith("/api/auth/sso/")) {
    const query = returnTo.split("?")[1] ?? "";
    const to = new URLSearchParams(query).get("to");
    return to ? `/?to=${encodeURIComponent(to)}` : "/";
  }

  if (returnTo.startsWith("/shasha")) return "/shasha/login";
  if (returnTo.startsWith("/docs")) return "/docs/login";

  const slug = returnTo.split("/")[1] ?? "";
  if (partnerBySlug(slug)) return `/${slug}/login`;

  return "/account";
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

// ---- Scopes ---------------------------------------------------------------
//
// Sign-in asks for `openid profile` and NOTHING ELSE, and that is a deliberate,
// defended line. Somebody who only ever takes a free ticket must never be shown a
// permission prompt asking to read their inventory - they would, quite rightly,
// wonder what a gig website wants with it, and some of them would say no and leave.
//
// The inventory scope is asked for LATER, and only from the one place that genuinely
// needs it: a buyer reaching a PAID checkout on a game-pass tier, at which point
// "may we check that you bought the ticket?" is a question that answers itself. That
// is what "incremental consent" means, and it is the entire reason these are two
// constants rather than one.

/** Ordinary sign-in. What almost every session in the system is. */
export const BASE_SCOPES = ["openid", "profile"] as const;

/**
 * The paid-checkout grant.
 *
 * `user.inventory-item:read` is what lets us ask Roblox whether they own the pass -
 * the check that makes the game-pass rail verifiable, and the whole reason it exists.
 *
 * `offline_access` is what makes Roblox issue a REFRESH TOKEN at all, and without it
 * this rail simply does not work: an access token lasts fifteen minutes, and a buyer
 * who comes back to their ticket tomorrow would find us unable to look anything up.
 * It is easy to leave out, and the failure it causes turns up hours later.
 */
export const INVENTORY_SCOPES = [
  ...BASE_SCOPES,
  "user.inventory-item:read",
  "offline_access",
] as const;

export function buildAuthorizeUrl(params: {
  state: string;
  challenge: string;
  redirectUri?: string;
  /** Defaults to BASE_SCOPES. Pass INVENTORY_SCOPES to ask for the paid grant. */
  scopes?: readonly string[];
}) {
  const url = new URL(env.roblox.authorizeUrl);
  url.searchParams.set("client_id", env.roblox.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri ?? redirectUri());
  url.searchParams.set("scope", (params.scopes ?? BASE_SCOPES).join(" "));
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

  /**
   * Only present when `offline_access` was asked for - so it is absent on every
   * ordinary sign-in, which is correct and not a bug to go hunting for.
   *
   * Roblox ROTATES these: spending one invalidates it and hands back a new one. That
   * makes refreshing a compare-and-swap rather than an update, and getting it wrong
   * permanently breaks a person's grant. See accessTokenFor() in lib/roblox-tokens.ts.
   */
  refresh_token?: string;

  /** Space-separated. What they ACTUALLY granted, which may be less than we asked. */
  scope?: string;
};

/**
 * Spend a refresh token for a fresh access token.
 *
 * The response carries a NEW refresh token and the one passed in is now dead. The
 * caller must store both halves or lose the grant - which is why the only caller is
 * lib/roblox-tokens.ts, and why it does it under a compare-and-swap.
 */
export async function refreshTokens(
  refreshToken: string,
): Promise<RobloxTokens | null> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: env.roblox.clientId,
    client_secret: env.roblox.clientSecret,
  });

  const res = await fetch(env.roblox.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  // NULL, not a throw. A refresh fails for two completely different reasons - Roblox is
  // having a bad minute (retry later), or the person revoked the grant (never retry) -
  // and the caller has to tell a buyer one of "hang on" or "please reconnect". Neither
  // sentence is written by an exception. The caller decides; see roblox-tokens.ts.
  if (!res.ok) return null;
  return res.json();
}

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

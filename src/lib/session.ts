import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env, portalRole } from "./env";

const secret = new TextEncoder().encode(env.authSecret);

export const USER_COOKIE = "ron_session";
export const ADMIN_COOKIE = "ron_admin";
export const PORTAL_COOKIE = "ron_portal";

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export type UserSession = {
  uid: string;
  robloxId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
};

async function sign(payload: Record<string, unknown>, expires: string) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(secret);
}

async function verify<T>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as T;
  } catch {
    return null;
  }
}

// Cookie options for setting on a NextResponse directly (used in route handlers,
// where writing via next/headers cookies() is not reliable across versions).
export function cookieOptions(maxAge: number) {
  return { ...cookieBase, maxAge };
}

/** Create a signed member session token (does not set a cookie). */
export async function createUserToken(session: UserSession) {
  return sign({ ...session }, "30d");
}

/** Create a signed admin session token (does not set a cookie). */
export async function createAdminToken() {
  return sign({ role: "admin" }, "12h");
}

// ---- Member (Roblox) session -------------------------------------
export async function setUserSession(session: UserSession) {
  const token = await sign({ ...session }, "30d");
  cookies().set(USER_COOKIE, token, {
    ...cookieBase,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getUserSession(): Promise<UserSession | null> {
  const token = cookies().get(USER_COOKIE)?.value;
  if (!token) return null;
  return verify<UserSession>(token);
}

export function clearUserSession() {
  cookies().set(USER_COOKIE, "", { ...cookieBase, maxAge: 0 });
}

// ---- Admin session -----------------------------------------------
export async function setAdminSession() {
  const token = await sign({ role: "admin" }, "12h");
  cookies().set(ADMIN_COOKIE, token, {
    ...cookieBase,
    maxAge: 60 * 60 * 12,
  });
}

export async function isAdmin(): Promise<boolean> {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  const payload = await verify<{ role?: string }>(token);
  return payload?.role === "admin";
}

export function clearAdminSession() {
  cookies().set(ADMIN_COOKIE, "", { ...cookieBase, maxAge: 0 });
}

// ---- SHASHA portal (Discord) session ------------------------------
export type DiscordSession = {
  did: string; // discord user id
  username: string;
  displayName: string;
  avatarUrl: string;
};

export type PortalUser = DiscordSession & {
  role: "manager" | "staff";
  canWrite: boolean;
};

const PORTAL_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function createPortalToken(session: DiscordSession) {
  return sign({ ...session }, "7d");
}

export function portalCookieOptions() {
  return cookieOptions(PORTAL_MAX_AGE);
}

/**
 * The signed-in portal user, or null.
 *
 * The cookie only proves *who* someone is — their access level is re-derived
 * from the env allowlist on every request, so removing an ID from
 * DISCORD_MANAGER_IDS revokes them immediately rather than whenever their
 * cookie happens to expire.
 */
export async function getPortalUser(): Promise<PortalUser | null> {
  const token = cookies().get(PORTAL_COOKIE)?.value;
  if (!token) return null;

  const payload = await verify<DiscordSession>(token);
  if (!payload?.did) return null;

  const role = portalRole(payload.did);
  if (!role) return null; // signed in, but no longer on the allowlist

  return {
    did: payload.did,
    username: payload.username,
    displayName: payload.displayName,
    avatarUrl: payload.avatarUrl,
    role,
    canWrite: role === "manager",
  };
}

export function clearPortalSession() {
  cookies().set(PORTAL_COOKIE, "", { ...cookieBase, maxAge: 0 });
}

// ---- Page guards --------------------------------------------------
//
// Every guarded PAGE must call one of these itself, before it reads any data —
// a guard in the layout alone is not enough.
//
// In the App Router, page segments render in parallel with their layout and are
// serialised into the RSC payload independently. If the layout redirects, that
// payload is still attached to the redirect response — so an unauthorised client
// receives the page's data (draft events, blacklist entries) in the body of the
// 307 it was bounced with. Redirecting from inside the page aborts that page's
// own render, which is what actually withholds the data.

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

export async function requirePortalUser(): Promise<PortalUser> {
  const user = await getPortalUser();
  if (!user) redirect("/shasha/login");
  return user;
}

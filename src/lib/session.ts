import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "./env";

const secret = new TextEncoder().encode(env.authSecret);

export const USER_COOKIE = "ron_session";
export const ADMIN_COOKIE = "ron_admin";

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

// The SHASHA portal has no session of its own: it signs in with Roblox, like
// everything else, and the cookie it uses is the ordinary member session above.
// It is scoped to portal.ronation.live because that is the host the OAuth round
// trip runs on, so a portal login is not a login on the main site. Access is
// decided by Roblox group rank on every request — see lib/shasha.ts.

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

// requireStudioUser() lives in lib/studio.ts and requirePortalUser() in
// lib/shasha.ts — both need a Roblox group lookup, which does not belong here.

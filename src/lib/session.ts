import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "./env";
import { USER_COOKIE } from "./session-cookie";

const secret = new TextEncoder().encode(env.authSecret);

// One cookie, one identity: your Roblox account.
//
// There used to be a second - `ron_admin`, minted from a shared username and
// password in the environment. It is gone. Every door is now a rank in RNL's
// Roblox group (lib/company.ts, lib/shasha.ts, lib/partners/guard.ts), which
// means access is per-person, revoked by demotion rather than by rotating a
// secret several people knew, and every write is attributable to an account.
//
// The name itself now lives in lib/session-cookie.ts, so the middleware can read
// it without importing this server-only module. Re-exported here because every
// existing caller imports it from this file, and there is no reason to make them
// all move.
export { USER_COOKIE };

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
    // Pin the algorithm. The key is a symmetric Uint8Array, so jose already
    // rejects `alg:none` and RS->HS confusion - this makes that explicit so a
    // future swap to an asymmetric key/JWKS can't silently widen accepted algs.
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
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

// No portal has a session of its own. /company, SHASHA and every partner portal
// all sign in with Roblox and carry the ordinary member cookie above. A portal
// cookie is scoped to portal.ronation.live, because that is the host its OAuth
// round trip runs on - so signing in there is not signing in on the main site.

// ---- Page guards --------------------------------------------------
//
// There are none here - they all need a Roblox group lookup, which does not
// belong in this file: requireCompanyUser() is in lib/company.ts,
// requirePortalUser() in lib/shasha.ts, requirePartnerUser() in
// lib/partners/guard.ts.
//
// Wherever they live, the rule is the same: every guarded PAGE must call one
// itself, before it reads any data - a guard in the layout alone is not enough.
//
// In the App Router, page segments render in parallel with their layout and are
// serialised into the RSC payload independently. If the layout redirects, that
// payload is still attached to the redirect response - so an unauthorised client
// receives the page's data (draft events, blacklist entries) in the body of the
// 307 it was bounced with. Redirecting from inside the page aborts that page's
// own render, which is what actually withholds the data.

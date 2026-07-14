import "server-only";
import { NextResponse } from "next/server";
import type { ApiKeyScope } from "@prisma/client";
import { resolveApiKey, hasScope, type ApiCaller } from "@/lib/apikey";

// The front door of /api/v1. Every route starts here, and no route authenticates
// itself: a route that does its own auth is a route that will one day forget to,
// and the one it forgets will be the one that hands out tickets.
//
// Two questions, in this order, and they get DIFFERENT answers on purpose:
//
//   401  I do not know who you are.       (no key, bad key, revoked key)
//   403  I know who you are, and no.      (a real key, without this scope)
//
// The split matters to whoever is integrating: a 401 means "your key is wrong",
// a 403 means "your key is right and you need to tick another box in the portal".
// Collapsing them into one status sends people to re-copy a key that was fine.

export type Authorized = { caller: ApiCaller };

const deny = (status: number, error: string, hint?: string) =>
  NextResponse.json({ ok: false, error, ...(hint ? { hint } : {}) }, { status });

/**
 * Authenticate the request and check it holds `scope`.
 *
 * Returns either the caller, or the response to send back. The route does:
 *
 *   const auth = await authorize(req, "TICKETS_REDEEM");
 *   if (auth instanceof NextResponse) return auth;
 *   // …auth.caller.scope is now the org this request may touch, and there is no
 *   //   way for the request to have widened it.
 */
export async function authorize(
  req: Request,
  scope: ApiKeyScope,
): Promise<Authorized | NextResponse> {
  const caller = await resolveApiKey(req);

  if (!caller) {
    return deny(
      401,
      "unauthorized",
      "Send your key as `x-api-key: <key>` (or `Authorization: Bearer <key>`). Mint one in your portal, under API keys.",
    );
  }

  if (!hasScope(caller, scope)) {
    return deny(
      403,
      "forbidden",
      `This key does not have the "${scope}" scope. A key's scopes are fixed when it is minted - add the scope by minting a new key in your portal.`,
    );
  }

  return { caller };
}

/** Parse a JSON body, or null if it isn't one. Never throws on garbage. */
export async function readJson(req: Request): Promise<Record<string, any>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

/** A 400 for a request we could not make sense of. */
export const badRequest = (error: string) => deny(400, error);

/**
 * Trim a value the caller sent into a string, or null.
 *
 * Numbers become strings deliberately - Luau's JSONEncode will happily send a
 * robloxId as a number, and refusing that would be a footgun for exactly the
 * people this API is for.
 */
export function str(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

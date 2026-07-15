import "server-only";
import { NextResponse } from "next/server";
import type { ApiKeyScope } from "@prisma/client";
import { resolveApiKey, hasScope, type ApiCaller } from "@/lib/apikey";
import { rateLimit } from "@/lib/rate-limit";

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

  // Per-key burst guard, keyed on the key's id so one leaked or misbehaving key is
  // throttled without touching anyone else's. Generous - a busy door scans a lot -
  // so it only bites a key being hammered; ship it loose and tighten later. The root
  // env key has no id and shares a single "root" bucket, which is one more reason to
  // retire it onto a minted key (see resolveApiKey).
  const rl = await rateLimit(`apikey:${caller.id ?? "root"}`, {
    limit: 600,
    windowSeconds: 60,
  });
  if (!rl.ok) {
    const res = deny(
      429,
      "rate_limited",
      "Too many requests on this key. Slow down and retry shortly.",
    );
    res.headers.set(
      "Retry-After",
      String(Math.max(1, Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000))),
    );
    return res;
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

/**
 * An id OR a slug -> the real event id. Null if there is no such show.
 *
 * The read endpoints have always taken either, because a game server is configured BY HAND
 * and "stro-the-first-rite" is a great deal easier to not get wrong than a cuid. The write
 * side (issueTicket, createPurchaseIntent) takes the id and only the id - it is the
 * authority, and it should not be in the business of guessing what you meant.
 *
 * The gap between those two facts is a trap, and it is a 2am one: a booth configured with a
 * slug reads the line-up, reads the seat map, draws the room perfectly - and then 404s the
 * moment somebody tries to hold a chair. So the routes close it here, once, rather than each
 * of them either remembering or not.
 */
export async function resolveEventId(key: string | null): Promise<string | null> {
  if (!key) return null;

  const { prisma } = await import("@/lib/db");
  const event = await prisma.event.findFirst({
    where: { OR: [{ id: key }, { slug: key }] },
    select: { id: true },
  });

  return event?.id ?? null;
}

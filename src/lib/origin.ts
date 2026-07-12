import "server-only";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { env } from "./env";

// The origin a request actually arrived on. The app answers on several hosts
// (ronation.live, portal.ronation.live, survey.ronation.live) and OAuth
// redirects have to come back to the one the user started on — sessions are
// cookies, and cookies are scoped per host.

const isLocalHost = (host: string) =>
  host.startsWith("localhost") ||
  host.startsWith("127.0.0.1") ||
  host.startsWith("[::1]") ||
  !host.includes(".");

/**
 * The scheme is not taken from x-forwarded-proto: Next's own server sets that
 * to "http" when nothing upstream overrides it, which would produce an http://
 * redirect_uri that no longer matches the https one registered with Roblox or
 * Discord. Any non-local host is assumed to be behind TLS.
 */
export function requestOrigin(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!host) return env.siteUrl;
  return `${isLocalHost(host) ? "http" : "https"}://${host}`;
}

/**
 * The same thing, for a server component, which has no NextRequest to hand.
 *
 * Reading headers() opts the route out of static rendering — every page that
 * calls this is already `force-dynamic`, because a ticket is per-person anyway.
 */
export function currentOrigin() {
  const host = headers().get("x-forwarded-host") || headers().get("host");
  if (!host) return env.siteUrl;
  return `${isLocalHost(host) ? "http" : "https"}://${host}`;
}

/**
 * The absolute URL a ticket's QR encodes — on the host the holder is actually
 * on, which is what keeps a Sleep Token RO ticket pointing at Sleep Token RO.
 *
 * `<slug>.ronation.live/tickets/ST-XXXXXX` is a real, working URL: the
 * middleware rewrites it to /p/<slug>/tickets/ST-XXXXXX. Scanning the mark on a
 * partner's ticket opens the partner's site, in the partner's brand.
 */
export function ticketUrl(code: string) {
  return `${currentOrigin()}/tickets/${code}`;
}

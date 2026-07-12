import "server-only";
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

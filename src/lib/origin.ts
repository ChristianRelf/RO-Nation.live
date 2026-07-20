import "server-only";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { env } from "./env";

// The origin a request actually arrived on. The app answers on several hosts
// (ronation.live, portal.ronation.live, survey.ronation.live) and OAuth
// redirects have to come back to the one the user started on - sessions are
// cookies, and cookies are scoped per host.

/**
 * Note `.localhost` - a partner site in dev is <slug>.localhost:3000, and the
 * obvious `host.startsWith("localhost")` does NOT match it. Getting this wrong
 * calls a local partner host remote and builds every URL for it as https://,
 * which is not a cosmetic slip: it is the wrong ORIGIN, so the Roblox callback
 * no longer matches the registered redirect_uri, and a Server Action redirect
 * becomes cross-origin and is dropped on the floor.
 *
 * The middleware's own copy of this check has always had the `.localhost` case.
 * This one had not, which is exactly the sort of thing two copies of a predicate
 * do to each other.
 */
const isLocalHost = (host: string) => {
  const name = host.replace(/:\d+$/, "").toLowerCase();
  return (
    name === "localhost" ||
    name.endsWith(".localhost") ||
    name === "127.0.0.1" ||
    name === "[::1]" ||
    !name.includes(".") // a bare docker hostname, e.g. `web`
  );
};

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
 * Reading headers() opts the route out of static rendering - every page that
 * calls this is already `force-dynamic`, because a ticket is per-person anyway.
 */
export function currentOrigin() {
  const host = headers().get("x-forwarded-host") || headers().get("host");
  if (!host) return env.siteUrl;
  return `${isLocalHost(host) ? "http" : "https"}://${host}`;
}

/**
 * The absolute URL a ticket's QR encodes - on the host the holder is actually
 * on, which is what keeps a Sleep Token ticket pointing at Sleep Token.
 *
 * It takes the ticket's opaque ID, not its code. The code is withheld until the
 * holder activates, so it must not appear in the URL either - see the note on the
 * lookup in app/tickets/[id]/page.tsx.
 *
 * `<slug>.ronation.live/tickets/<id>` is a real, working URL: the middleware
 * rewrites it to /p/<slug>/tickets/<id>. Scanning the mark on a partner's ticket
 * opens the partner's site, in the partner's brand.
 */
export function ticketUrl(id: string) {
  return `${currentOrigin()}/tickets/${id}`;
}

/**
 * The absolute URL of a SHOW, on the host the visitor is actually on.
 *
 * The sibling of ticketUrl above, and the one that is safe to hand to somebody
 * else: a ticket link is private and 404s for anybody but its holder, an event link
 * is the public page. Same host rule, so sharing from a partner's site sends people
 * to the partner's site - `<slug>.ronation.live/events/<slug>` is real, and the
 * middleware rewrites it to /p/<slug>/events/<slug>.
 */
export function eventUrl(slug: string) {
  return `${currentOrigin()}/events/${slug}`;
}

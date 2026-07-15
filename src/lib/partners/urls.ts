import { env } from "@/lib/env";

/**
 * The public origin of a partner site: https://<slug>.ronation.live.
 *
 * Derived from RNL's own origin, so it follows the environment - in dev it
 * comes out as http://<slug>.localhost:3000, which is exactly the host you add
 * to /etc/hosts to exercise partner routing locally.
 */
export function partnerOrigin(slug: string) {
  const url = new URL(env.siteUrl);
  url.hostname = `${slug}.${url.hostname.replace(/^www\./, "")}`;
  return url.origin;
}

// ------------------------------------------------------------------
// Public vs internal paths.
//
// Both exist because the middleware rewrites, and mixing them up fails in two
// different, quiet ways:
//
//   public   /sleeptokenro/vip     ← what the browser is on. Links, redirects.
//   internal /pp/sleeptokenro/vip  ← what Next actually renders. revalidatePath.
//
// A <Link> to the internal path bounces through the middleware's leak-guard
// redirect. A revalidatePath() of the *public* path is worse: it matches no
// route, throws nothing, and the list simply keeps serving stale after a write.
// Reach for the helper named after what you are doing.
// ------------------------------------------------------------------

/** Public path of a partner's portal, ON the portal host. `/sleeptokenro/vip` */
export function partnerPortalPath(slug: string, sub = "") {
  return `/${slug}${sub}`;
}

/**
 * Absolute URL of a partner's portal page, on the portal host:
 * https://portal.ronation.live/<slug><sub> (http://portal.localhost:3000/… in
 * dev). For links that LEAVE the app - a Discord embed pointing a partner's crew
 * at the row - where a site-relative path would resolve against the wrong host.
 */
export function partnerPortalUrl(slug: string, sub = "") {
  const url = new URL(env.siteUrl);
  url.hostname = `portal.${url.hostname.replace(/^www\./, "")}`;
  url.pathname = partnerPortalPath(slug, sub);
  return url.toString();
}

/** Internal path Next renders that portal at. For revalidatePath ONLY. */
export function partnerPortalRoute(slug: string, sub = "") {
  return `/pp/${slug}${sub}`;
}

/** Internal path Next renders a partner's public site at. For revalidatePath ONLY. */
export function partnerSiteRoute(slug: string, sub = "") {
  return `/p/${slug}${sub}`;
}

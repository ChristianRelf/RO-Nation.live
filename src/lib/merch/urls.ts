import { env } from "@/lib/env";
import { slugify } from "@/lib/utils";

/**
 * The shop's public origin: https://merch.ronation.live.
 *
 * Derived from RNL's own origin, exactly as partnerOrigin() is, so dev and
 * production agree by construction - locally it comes out as
 * http://merch.localhost:3000, which is the host you actually browse.
 *
 * MERCH is the canonical one. shop.ronation.live exists, resolves, and holds a
 * certificate, but it only ever 301s here (see the middleware): two hostnames,
 * one set of URLs, one entry in Google.
 */
export function merchOrigin() {
  const url = new URL(env.siteUrl);
  url.hostname = `merch.${url.hostname.replace(/^www\./, "")}`;
  return url.origin;
}

// ------------------------------------------------------------------
// Public vs internal paths - the same trap the partner sites have.
//
//   public   /sleeptoken/pentagram-tee        ← what the browser is on. Links.
//   internal /merch/sleeptoken/pentagram-tee  ← what Next renders. revalidatePath.
//
// The merch host rewrites everything under /merch, so a <Link> to the internal
// path works but puts an ugly, wrong URL in the bar - and a revalidatePath() of
// the PUBLIC path is the quiet one: it matches no route, throws nothing, and the
// shop simply keeps serving a sold-out shirt until something else evicts it.
// ------------------------------------------------------------------

/** Public path of a collection, ON the merch host. `/sleeptoken` */
export function collectionPath(slug: string) {
  return `/${slug}`;
}

/** Public path of a product. `/sleeptoken/pentagram-tee` */
export function productPath(collection: string, slug: string) {
  return `/${collection}/${slug}`;
}

/** Internal path Next renders the shop at. For revalidatePath ONLY. */
export function merchRoute(sub = "") {
  return `/merch${sub}`;
}

/**
 * The catalog page on Roblox - where the money actually changes hands.
 *
 * THE one function that builds this link. RNL takes no payment: the whole shop is
 * a showcase that hands off to Roblox, so this URL is the entire point of every
 * product page, and there is exactly one place it can be got wrong.
 *
 * Roblox ignores the slug segment and resolves purely on the id - it is there for
 * humans and for search engines. A product whose name is all punctuation slugifies
 * to "", which would give a double slash and a URL that still works but looks
 * broken; "item" is the fallback for that.
 */
export function robloxCatalogUrl(assetId: string, name: string) {
  return `https://www.roblox.com/catalog/${assetId}/${slugify(name) || "item"}`;
}

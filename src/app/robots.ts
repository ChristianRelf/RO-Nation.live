import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { env } from "@/lib/env";

// robots.txt, for whichever host asked for it.
//
// ---- Why this is host-aware -------------------------------------------------
//
// One route file serves every host that lets /robots.txt through, and until the partner
// programme existed that was only the main site, so the rules could be written as if there
// were one answer. There are now two, and they are genuinely different:
//
//   ronation.live          a marketing site with staff areas bolted to the side of it.
//                          Index nearly everything; keep crawlers out of /company, /hub
//                          and the rest of the backstage surface.
//
//   partner.ronation.live  a host whose FRONT is a commercial pitch that RNL wants found,
//                          and whose BACK is bearer links. /invite/<uuid> and
//                          /onboard/site/<uuid> ARE their own authorisation - an indexed
//                          one is a published link that mints a partner account or opens
//                          somebody's unreleased artwork.
//
// The pages themselves already carry `robots: { index: false }` in their metadata, and that
// is the real defence - a robots.txt is a request, not a lock, and it is read by the
// crawlers that were going to behave anyway. This is the second layer, and it is worth
// having because the first one is a line in a file somebody could delete without noticing.
//
// ---- The host comes from the middleware, not from the request --------------
//
// x-ron-area is set by src/middleware.ts on every path through it, from the Host header,
// and overwritten each time - a client cannot supply it. Reading the raw Host header here
// would work too, but the area is the value this codebase already trusts for exactly this
// kind of "which product am I" decision (see the root layout).
export default function robots(): MetadataRoute.Robots {
  const area = headers().get("x-ron-area");

  if (area === "partner-program") {
    return {
      rules: {
        userAgent: "*",
        // The programme and the application form. Both are public on purpose: a
        // commercial offer whose front page cannot be found is half an offer.
        allow: ["/", "/join"],
        disallow: [
          // Bearer links. See above - these are the ones that matter.
          "/invite",
          "/onboard",
          // A partner's own area, and the page that explains why they cannot open it.
          "/hub",
          "/access",
          "/login",
          "/api/",
        ],
      },
      // No sitemap line. This host has three indexable URLs and no sitemap route; pointing
      // at the main site's would be naming another host's map, which is worse than none.
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The account-scoped areas, plus the internal (mostly portal-host) areas.
      // The latter live behind a rank gate and redirect off the main host anyway,
      // but a crawler that follows one of those redirects should not index the
      // staff surface it lands on. Path-based, matching how middleware routes them.
      disallow: [
        "/company",
        "/account",
        "/tickets",
        "/api/",
        "/shasha",
        "/hub",
        "/portal",
        "/docs",
        "/authorise",
        // The partner programme host's private half, reachable from here as /partner/…
        // because the main site forwards that whole namespace to it. The forward is a
        // redirect, so a well-behaved crawler never indexes the destination under this
        // host's name - and a crawler that follows it lands on the rules above.
        "/partner/invite",
        "/partner/onboard",
        "/partner/hub",
      ],
    },
    sitemap: `${env.siteUrl}/sitemap.xml`,
  };
}

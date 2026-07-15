import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
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
      ],
    },
    sitemap: `${env.siteUrl}/sitemap.xml`,
  };
}

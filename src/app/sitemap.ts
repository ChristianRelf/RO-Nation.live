import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

// Static, high-level routes. Individual event/career pages are intentionally
// left out here to keep this build-safe (no DB access at build time).
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/events",
    "/careers",
    "/about",
    "/contact",
    "/faq",
    "/team",
    "/partners",
    "/legal/privacy",
    "/legal/terms",
    "/legal/code-of-conduct",
    "/legal/roblox/privacy",
    "/legal/roblox/terms",
    "/legal/discord/privacy",
    "/legal/discord/terms",
  ];
  const now = new Date();
  return routes.map((path) => ({
    url: `${env.siteUrl}${path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}

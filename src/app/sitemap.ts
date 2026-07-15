import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import {
  getUpcomingEvents,
  getPastEvents,
  getPublishedPosts,
  getOpenCareers,
} from "@/lib/queries";

// Re-read at most hourly. The dynamic tail below hits the database, and an hour is
// fine staleness for a sitemap - this keeps the route off the request path (it is
// not force-dynamic) while still advertising real content.
export const revalidate = 3600;

// High-level routes that exist whatever the database says. Kept exactly as they
// were, so the sitemap is never *worse* than the old static one even if the DB is
// unreachable when this is generated.
const STATIC_ROUTES = [
  "",
  "/events",
  "/blog",
  "/careers",
  "/about",
  "/contact",
  "/faq",
  "/team",
  "/partners",
  "/press",
  "/services",
  "/legal",
  "/legal/privacy",
  "/legal/terms",
  "/legal/code-of-conduct",
  "/legal/roblox/privacy",
  "/legal/roblox/terms",
  "/legal/discord/privacy",
  "/legal/discord/terms",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${env.siteUrl}${path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));

  // scope null = RNL's own. A partner's events, posts and roles live on their own
  // host and belong in their own sitemap - never here.
  //
  // Wrapped so a build with no database reachable still emits the static routes
  // rather than failing: that was the whole reason this file used to skip the DB.
  // The hourly revalidate fills the tail in at runtime, where the DB is always up.
  let dynamicEntries: MetadataRoute.Sitemap = [];
  try {
    const [upcoming, past, posts, careers] = await Promise.all([
      getUpcomingEvents(null),
      getPastEvents(null),
      getPublishedPosts(null),
      getOpenCareers(null),
    ]);

    dynamicEntries = [
      ...[...upcoming, ...past].map((e) => ({
        url: `${env.siteUrl}/events/${e.slug}`,
        lastModified: e.startsAt,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
      ...posts.map((p) => ({
        url: `${env.siteUrl}/blog/${p.slug}`,
        lastModified: p.publishedAt ?? now,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
      ...careers.map((c) => ({
        url: `${env.siteUrl}/careers/${c.slug}`,
        lastModified: c.createdAt,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ];
  } catch {
    // DB unreachable at generation time - ship the static routes alone.
  }

  return [...staticEntries, ...dynamicEntries];
}

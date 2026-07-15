import { env } from "@/lib/env";

/**
 * Turn a stored path into an absolute URL against the site origin.
 *
 * Thumbnails and covers are stored as site-relative paths (/uploads/…) most of
 * the time, but a row *may* already hold an absolute URL. Social cards and
 * JSON-LD both need an absolute one - a crawler has no origin to resolve a
 * leading slash against - so this leaves an http(s) URL untouched and prefixes
 * everything else with env.siteUrl. Same origin metadataBase uses, so canonical
 * URLs and image URLs never disagree.
 */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${env.siteUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}

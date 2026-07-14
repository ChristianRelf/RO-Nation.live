import "server-only";
import type { BrandAsset, Guide } from "@prisma/client";
import { prisma } from "./db";
import { UPLOAD_URL_PREFIX } from "./uploads";

// Shared reads for the docs - the authoring side at /company/docs and the reading
// side at portal.ronation.live/docs both come through here, so the two cannot
// disagree about what a section is or which guides are live.

/**
 * The sections already in use, for the editor's datalist.
 *
 * `section` is free text on purpose (an enum would make adding one a deploy), and
 * the price of free text is that "Running a show" and "running a show" become two
 * headings on the index. Offering what already exists is what keeps that rare.
 */
export async function guideSections(): Promise<string[]> {
  const rows = await prisma.guide.findMany({
    distinct: ["section"],
    select: { section: true },
    orderBy: { section: "asc" },
  });
  return rows.map((r) => r.section);
}

/**
 * Published guides, grouped by section, in reading order.
 *
 * The `status` filter is the only thing standing between an unfinished guide and
 * every read-only staffer on the platform. It belongs here, once, rather than in
 * each page that lists them.
 */
export async function publishedGuidesBySection(): Promise<
  { section: string; guides: Guide[] }[]
> {
  const guides = await prisma.guide.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ section: "asc" }, { order: "asc" }, { title: "asc" }],
  });

  const sections: { section: string; guides: Guide[] }[] = [];
  for (const guide of guides) {
    const last = sections[sections.length - 1];
    if (last && last.section === guide.section) last.guides.push(guide);
    else sections.push({ section: guide.section, guides: [guide] });
  }
  return sections;
}

// ------------------------------------------------------------------
// Brand assets.
// ------------------------------------------------------------------

/**
 * Where an asset is fetched from.
 *
 * The ONLY function that turns a BrandAsset row into a URL - so there is exactly
 * one place in the codebase that can get the PUBLIC/INTERNAL split wrong, and it
 * is three lines long. Anything that wants to link, embed or preview an asset
 * comes through here; nothing builds `/uploads/...` from a storagePath by hand.
 */
export function brandAssetHref(
  asset: Pick<BrandAsset, "id" | "visibility" | "storagePath">,
): string {
  return asset.visibility === "INTERNAL"
    ? `/files/${asset.id}` // streamed by app/files/[id], session checked
    : `${UPLOAD_URL_PREFIX}/${asset.storagePath}`; // /uploads/... - served by Caddy
}

/** Every asset, grouped by category, in display order. */
export async function brandAssetsByCategory(): Promise<
  { category: string; assets: BrandAsset[] }[]
> {
  const assets = await prisma.brandAsset.findMany({
    orderBy: [{ category: "asc" }, { order: "asc" }, { title: "asc" }],
  });

  const groups: { category: string; assets: BrandAsset[] }[] = [];
  for (const asset of assets) {
    const last = groups[groups.length - 1];
    if (last && last.category === asset.category) last.assets.push(asset);
    else groups.push({ category: asset.category, assets: [asset] });
  }
  return groups;
}

/**
 * The PUBLIC assets only, grouped by category. What the press kit is made of.
 *
 * `visibility` decides which Docker volume the bytes live on, and the schema is explicit
 * about why PUBLIC exists: "a shareable URL is the FEATURE here - a partner pasting a logo
 * link into a Discord is the entire point, and it keeps working when they are signed out,
 * which is when they will be using it."
 *
 * And yet the only surface that had ever listed one was /docs/brandassets, which is behind
 * a portal login. The flag was shipped, correct, and pointed at nothing. /press is the
 * public home it was built for.
 *
 * The filter lives HERE, once - never in the page - for exactly the reason
 * publishedGuidesBySection() gives about `status`: it is the only thing standing between a
 * gated file and the open internet, and a page that has to remember to add a `where` is a
 * page that will one day forget.
 */
export async function publicBrandAssetsByCategory(): Promise<
  { category: string; assets: BrandAsset[] }[]
> {
  const assets = await prisma.brandAsset.findMany({
    where: { visibility: "PUBLIC" },
    orderBy: [{ category: "asc" }, { order: "asc" }, { title: "asc" }],
  });

  const groups: { category: string; assets: BrandAsset[] }[] = [];
  for (const asset of assets) {
    const last = groups[groups.length - 1];
    if (last && last.category === asset.category) last.assets.push(asset);
    else groups.push({ category: asset.category, assets: [asset] });
  }
  return groups;
}

/** The categories already in use, for the uploader's datalist. */
export async function assetCategories(): Promise<string[]> {
  const rows = await prisma.brandAsset.findMany({
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });
  return rows.map((r) => r.category);
}

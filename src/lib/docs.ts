import "server-only";
import type {
  AssetVisibility,
  BrandAsset,
  Guide,
  GuideKind,
} from "@prisma/client";
import { prisma } from "./db";
import { UPLOAD_URL_PREFIX } from "./uploads";
import { readBrandPresets } from "./brand-presets";

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
export async function publishedGuidesBySection(
  // Which docs area to read. Defaults to GUIDE so the original /docs/guides call
  // site is unchanged; /docs/runbooks and /docs/onboarding pass their own kind.
  kind: GuideKind = "GUIDE",
): Promise<{ section: string; guides: Guide[] }[]> {
  const guides = await prisma.guide.findMany({
    where: { status: "PUBLISHED", kind },
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

/**
 * One asset as the reader surfaces need it: the display fields, plus a RESOLVED href.
 *
 * The shape a BrandAsset row and a folder preset (lib/brand-presets.ts) have in common, so
 * the library, the press kit and the templates page can list both from one array and the
 * AssetViewer can draw either without knowing which it is. The href is resolved once, at the
 * boundary - by brandAssetHref for a row, by the preset's own public path - so the viewer
 * never builds a URL and there is still exactly one place the PUBLIC/INTERNAL split is made.
 */
export type BrandAssetView = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  visibility: AssetVisibility;
  mime: string;
  size: number;
  filename: string;
  href: string;
};

/** A BrandAsset ROW as a view - the one place a row's href is resolved. */
function toAssetView(a: BrandAsset): BrandAssetView {
  return {
    id: a.id,
    category: a.category,
    title: a.title,
    description: a.description,
    visibility: a.visibility,
    mime: a.mime,
    size: a.size,
    filename: a.filename,
    href: brandAssetHref(a),
  };
}

/**
 * Group views by category, first-seen order, MERGING non-adjacent same-category items.
 *
 * A plain "is this the same category as the last one" fold (which the row-only groupers
 * below use) would split a category into two headings when presets and uploads share its
 * name but are not next to each other in the list. This keeps one heading per category, with
 * the presets - which come first in the input - sitting above the uploads under it.
 */
function groupViews(
  views: BrandAssetView[],
): { category: string; assets: BrandAssetView[] }[] {
  const order: string[] = [];
  const byCategory = new Map<string, BrandAssetView[]>();
  for (const v of views) {
    let arr = byCategory.get(v.category);
    if (!arr) {
      arr = [];
      byCategory.set(v.category, arr);
      order.push(v.category);
    }
    arr.push(v);
  }
  return order.map((category) => ({
    category,
    assets: byCategory.get(category)!,
  }));
}

/**
 * The brand LIBRARY - the base folder presets, then every uploaded ASSET (both
 * visibilities), grouped. What /docs/brandassets shows a signed-in reader.
 */
export async function brandLibraryGroups(): Promise<
  { category: string; assets: BrandAssetView[] }[]
> {
  const uploaded = await prisma.brandAsset.findMany({
    where: { kind: "ASSET" },
    orderBy: [{ category: "asc" }, { order: "asc" }, { title: "asc" }],
  });
  return groupViews([...readBrandPresets(), ...uploaded.map(toAssetView)]);
}

/**
 * The PUBLIC brand assets - base presets (all public) plus uploaded PUBLIC assets. What the
 * press kit is made of. The `visibility` filter on the upload query is the only thing
 * standing between a gated file and the open internet, so it lives HERE, once - see the note
 * publishedGuidesBySection() gives about `status`.
 */
export async function publicBrandLibraryGroups(): Promise<
  { category: string; assets: BrandAssetView[] }[]
> {
  const uploaded = await prisma.brandAsset.findMany({
    where: { visibility: "PUBLIC", kind: "ASSET" },
    orderBy: [{ category: "asc" }, { order: "asc" }, { title: "asc" }],
  });
  return groupViews([...readBrandPresets(), ...uploaded.map(toAssetView)]);
}

/** The TEMPLATE downloads as views, grouped. No presets - those are logos, not run sheets. */
export async function templateGroups(): Promise<
  { category: string; assets: BrandAssetView[] }[]
> {
  const uploaded = await prisma.brandAsset.findMany({
    where: { kind: "TEMPLATE" },
    orderBy: [{ category: "asc" }, { order: "asc" }, { title: "asc" }],
  });
  return groupViews(uploaded.map(toAssetView));
}

/**
 * EVERY uploaded asset, both kinds, grouped by category. The authoring list at
 * /company/docs/assets uses this - a template must not vanish from the page that manages it
 * just because the reader surfaces (brandLibraryGroups / templateGroups) split by kind. The
 * kind is shown there as a badge instead of splitting the list.
 *
 * Returns rows, not views, and lists NO folder presets - a preset has no row to edit or
 * delete, so it has no place on a page whose whole job is managing rows. The base set is
 * managed by adding and removing files in public/brand/brandassets (lib/brand-presets.ts).
 */
export async function allBrandAssetsByCategory(): Promise<
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

/** The categories already in use, for the uploader's datalist. */
export async function assetCategories(): Promise<string[]> {
  const rows = await prisma.brandAsset.findMany({
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });
  return rows.map((r) => r.category);
}

import "server-only";
import { readdirSync, statSync } from "fs";
import { join } from "path";
import type { BrandAssetView } from "./docs";

// The BASE brand assets - the ones that ship with the repo rather than being uploaded
// through the app.
//
// They live as plain files under public/brand/brandassets/<category>/, so adding one is
// dropping a file in a folder - no database row, no upload form. This reads that folder at
// request time and turns each file into the same shape a BrandAsset row becomes (a
// BrandAssetView), so the brand library and the press kit can show the base set and the
// in-app uploads in one list without caring which is which.
//
// A REGISTRY that reads a directory rather than one that lists files by hand, precisely so
// "I'll add more later" means copying a file in, not editing this module. Everything here is
// PUBLIC: the files sit under /public, which Caddy serves to anyone, so pretending otherwise
// would be a lie the URL already tells the truth about.

const PRESET_ROOT = join(process.cwd(), "public", "brand", "brandassets");
const PUBLIC_PREFIX = "/brand/brandassets";

// The known subfolders, in the order they should appear, with the heading each gets. A
// folder not listed here still shows up (title-cased, after these), so a new category is
// also just a new folder - this only fixes the order and wording of the ones we expect.
const CATEGORY_LABELS: Record<string, string> = {
  standard: "Standard logo",
  square: "Square logo",
  circle: "Circle logo",
  favicons: "Favicons",
};
const CATEGORY_ORDER = ["standard", "square", "circle", "favicons"];

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
};

/** "logo-white-clear.png" → "Logo white clear". A readable title from a filename. */
function titleFromName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : name;
}

function orderOf(dir: string): number {
  const i = CATEGORY_ORDER.indexOf(dir);
  return i === -1 ? CATEGORY_ORDER.length : i;
}

/**
 * Every base asset in the folder, as views, in category then filename order. Returns an
 * empty list if the folder is absent - a missing base set is nothing to show, not an error.
 */
export function readBrandPresets(): BrandAssetView[] {
  let dirs: string[];
  try {
    dirs = readdirSync(PRESET_ROOT, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }

  dirs.sort((a, b) => orderOf(a) - orderOf(b) || a.localeCompare(b));

  const out: BrandAssetView[] = [];
  for (const dir of dirs) {
    const category = CATEGORY_LABELS[dir] ?? titleFromName(dir);

    let files: string[];
    try {
      files = readdirSync(join(PRESET_ROOT, dir))
        .filter((f) => !f.startsWith("."))
        .sort((a, b) => a.localeCompare(b));
    } catch {
      continue;
    }

    for (const file of files) {
      const dot = file.lastIndexOf(".");
      if (dot < 0) continue;
      const mime = MIME_BY_EXT[file.slice(dot).toLowerCase()];
      if (!mime) continue; // a README or stray file is not an asset

      let size = 0;
      try {
        size = statSync(join(PRESET_ROOT, dir, file)).size;
      } catch {
        // Vanished between listing and stat - just show it with an unknown size.
      }

      out.push({
        id: `preset:${dir}/${file}`,
        category,
        title: titleFromName(file),
        description: null,
        visibility: "PUBLIC",
        mime,
        size,
        filename: file,
        // Served straight off /public by Caddy - no /uploads, no /files gate.
        href: `${PUBLIC_PREFIX}/${dir}/${file}`,
      });
    }
  }

  return out;
}

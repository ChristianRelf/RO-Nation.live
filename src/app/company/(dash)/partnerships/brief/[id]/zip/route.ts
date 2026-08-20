import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/db";
import { getCompanyUser } from "@/lib/company";
import { PRIVATE_UPLOAD_DIR, resolveInRoot } from "@/lib/uploads";
import { briefZipEntries, zipAssetName } from "@/lib/partner-brief";
import { buildZip, safeFilename, type ZipEntry } from "@/lib/zip";
import { contentDisposition } from "@/lib/private-file";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The site brief as a .zip - the ONE way a partner's artwork leaves this system.
//
// ---- The guard is the whole point of this route ---------------------------
//
// A brief's files are on the private volume: Caddy does not have that directory in its
// filesystem, nothing lists it, and no URL serves it (see lib/uploads.ts). So the only
// door onto those bytes is this one, and it checks company rank on every single request -
// not on the page that links to it, which would be a permission somebody could route
// around by typing the URL.
//
// It is under /company, so the dash's own guard applies as well. That is belt and braces,
// and deliberate: a route handler does not get a layout's guard for free, and a reader of
// this file should not have to go and check whether it did.
//
// ---- Why the whole thing is built in memory --------------------------------
//
// A brief holds a handful of files, capped at 5 MB an image and 25 MB a PDF, with a
// ceiling of 24 files (api/partner/brief). The worst case is therefore large but bounded,
// and the alternative - streaming the archive - would mean either a second pass to compute
// the central directory or data descriptors, for a download somebody does two or three
// times in the life of a partnership. See lib/zip.ts, which says the same thing from the
// other end.
//
// ---- A missing file is a line in the archive, not a 500 --------------------
//
// A row whose bytes have gone (a botched restore, a manual tidy-up) must not take the
// whole download with it. The zip is built anyway, and MISSING-FILES.txt names what could
// not be read - because the person downloading this needs to know which asset to ask for
// again, and an error page tells them nothing.

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCompanyUser();
  if (!user) return new NextResponse("Not found", { status: 404 });

  const brief = await prisma.partnerSiteBrief.findUnique({
    where: { id: params.id },
    include: { assets: { orderBy: { createdAt: "asc" } } },
  });
  if (!brief) return new NextResponse("Not found", { status: 404 });

  // The text half - markdown, JSON, and a draft registry entry. First in the archive, in
  // that order, because it is the order somebody should read them in.
  const entries: ZipEntry[] = briefZipEntries(brief);

  const missing: string[] = [];
  for (const asset of brief.assets) {
    const target = resolveInRoot(PRIVATE_UPLOAD_DIR, asset.storagePath);
    if (!target) {
      // resolveInRoot refused the path - it escapes the root. Nothing writes a path like
      // that (the store generates them), so this means a tampered row, and it is worth
      // naming rather than silently skipping.
      missing.push(`${asset.filename} (bad path on record)`);
      continue;
    }
    try {
      const data = await readFile(target);
      entries.push({ name: `assets/${zipAssetName(asset)}`, data });
    } catch {
      missing.push(`${asset.filename} (${assetSlot(asset.slot)})`);
    }
  }

  if (missing.length) {
    entries.push({
      name: "MISSING-FILES.txt",
      data: [
        "These files are on the brief but could not be read off the disk.",
        "The rows still exist; the bytes do not. Ask the partner to re-upload them.",
        "",
        ...missing.map((m) => `- ${m}`),
        "",
      ].join("\n"),
    });
  }

  const zip = await buildZip(entries);
  const name = safeFilename(
    `${brief.slug || brief.siteName || brief.label} site brief`,
    "site brief",
  );

  return new NextResponse(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(zip.length),
      // Always an attachment. contentDisposition() strips anything in the name that could
      // end the quoted string or inject a second header - the partner chose part of this
      // name, so it is user input in a response header.
      "Content-Disposition": contentDisposition(`${name}.zip`, false),
      // The same rule every gated file in this codebase follows: a shared cache holding
      // one of these and handing it to the next person who asks is the failure that
      // undoes the guard above. See lib/private-file.ts.
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** The slot name, for the missing-files note. Lower-cased and readable. */
const assetSlot = (slot: string) => slot.toLowerCase().replace(/_/g, " ");

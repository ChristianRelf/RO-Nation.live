import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCompanyUser } from "@/lib/company";
import {
  ASSET_TYPES,
  MAX_UPLOAD_BYTES,
  RNL_SCOPE,
  savePrivateUpload,
  saveUpload,
} from "@/lib/uploads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Brand assets go in HERE, and not through /api/uploads, on purpose.
//
// That route has a partner branch: post a `partner` field and it runs the partner
// guard instead of the company one. Adding a "write this to the private volume"
// flag there would mean remembering, forever and in every future edit, that a
// partner's manager must never be allowed to set it. This route has no partner
// branch and no rule to remember: brand assets are RNL's, authored from
// /company/docs, full stop.
//
// A route handler rather than a server action for the same reason as the other
// one: actions cap their body at 1 MB, and a brand guideline PDF is twenty times
// that.

export async function POST(req: NextRequest) {
  const user = await getCompanyUser();
  if (!user) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Malformed upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file." }, { status: 400 });
  }

  // The one thing the client decides here — and it decides which DISK the bytes
  // land on, so it is compared against the enum and nothing else. Anything that
  // is not exactly "INTERNAL" is public, which is the safe way round to fail: a
  // typo makes a logo public, not a guideline.
  const internal = String(form.get("visibility") ?? "") === "INTERNAL";

  // ---- the private door ---------------------------------------------
  // No MediaAsset row: that table is the ledger of the volume Caddy serves, and
  // these bytes are not on it. The BrandAsset row the form creates next IS this
  // file's ledger, and the only thing that can find it at all.
  if (internal) {
    const saved = await savePrivateUpload(file, RNL_SCOPE, {
      accept: ASSET_TYPES,
    });
    if (!saved.ok) return refuse(saved);
    return describe(saved);
  }

  // ---- the public door ----------------------------------------------
  const saved = await saveUpload(file, RNL_SCOPE, { accept: ASSET_TYPES });
  if (!saved.ok) return refuse(saved);

  // A file sitting on the public volume needs to be attributable to a person.
  // That is what this row is for, and every other public upload writes one.
  await prisma.mediaAsset.create({
    data: {
      partnerId: null,
      url: saved.url,
      filename: saved.filename,
      mime: saved.mime,
      size: saved.size,
      uploadedById: user.robloxId,
      uploadedByName: user.displayName,
    },
  });

  return describe(saved);
}

function refuse(saved: { error: string; limit?: number }) {
  const message =
    saved.error === "too-large"
      ? // The cap depends on what the bytes turned out to be — 25 MB for a PDF,
        // 5 MB for an image — so name the one that was actually broken.
        `That file is over ${Math.round((saved.limit ?? MAX_UPLOAD_BYTES) / 1024 / 1024)} MB.`
      : saved.error === "empty"
        ? "That file is empty."
        : "That isn't a file we accept (JPG, PNG, GIF, WebP, SVG or PDF).";
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * What the form needs to file the thing we just stored.
 *
 * These ride back through the browser as hidden inputs, so they are forgeable —
 * and they are NOT trusted when they return. createBrandAsset re-validates the
 * shape of storagePath, resolves it inside its root, and takes the real size from
 * disk. See app/actions/docs.ts.
 */
function describe(saved: {
  storagePath: string;
  filename: string;
  mime: string;
  size: number;
}) {
  return NextResponse.json({
    storagePath: saved.storagePath,
    filename: saved.filename,
    mime: saved.mime,
    size: saved.size,
  });
}

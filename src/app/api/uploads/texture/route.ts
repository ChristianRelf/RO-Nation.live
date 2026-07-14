import { NextRequest, NextResponse } from "next/server";
import { getCompanyUser } from "@/lib/company";
import { RNL_SCOPE, savePrivateUpload } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The door a clothing template comes in by - and it is a DIFFERENT door from
// /api/uploads on purpose.
//
// That one writes to the volume Caddy serves and hands back a public URL. For a shirt
// template that is the whole vulnerability: the file IS the product, and a public URL
// for it is a free copy for anybody who views source. So a template goes to the
// private volume - the one docker-compose deliberately does not mount into Caddy - and
// what comes back is a STORAGE PATH, not a URL. Nothing can serve it; the only reader
// is lib/merch/plate.ts, one shredded face at a time.
//
// Keeping the two doors apart is what makes that hard to undo by accident. There is no
// flag on the public route that could be left off, and no way for a template to end up
// on the public volume without somebody deliberately routing it there.

/** Templates are PNGs. Alpha is load-bearing - the uncovered parts must show skin. */
const TEMPLATE_TYPES = ["image/png"] as const;

export async function POST(req: NextRequest) {
  // RNL staff only. There is no partner scope here: the shop is RNL's own shelf, and
  // a partner has no business uploading to it.
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

  const saved = await savePrivateUpload(file, RNL_SCOPE, {
    accept: TEMPLATE_TYPES,
  });

  if (!saved.ok) {
    const message =
      saved.error === "too-large"
        ? "That file is over 5 MB - a template should be a few hundred KB."
        : saved.error === "empty"
          ? "That file is empty."
          : "A clothing template has to be a PNG. (Roblox's own template file is one.)";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // No MediaAsset row. That model records PUBLIC files - its `url` column is documented
  // as the /uploads path that goes into a thumbnailUrl - and a template has no URL to
  // record. The product row's texturePath is the only pointer to it, which also means
  // clearing the field is genuinely un-publishing the shirt.
  return NextResponse.json({ path: saved.storagePath });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCompanyUser } from "@/lib/company";
import { getPartnerAccess } from "@/lib/partners/guard";
import { partnerBySlug } from "@/lib/partners/registry";
import {
  IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  RNL_SCOPE,
  saveUpload,
} from "@/lib/uploads";

export const dynamic = "force-dynamic";
// Node, not edge: this writes to the filesystem.
export const runtime = "nodejs";

// The one way a file gets onto RNL's disk.
//
// It is a ROUTE HANDLER rather than a server action on purpose. Server actions
// cap their request body at 1 MB by default, so a 5 MB image posted through one
// fails with an opaque error — and raising that limit would raise it for every
// action in the app, including the ones that should only ever carry a few text
// fields.
//
// The client posts here directly and gets back a URL, which it drops into the
// form's existing thumbnailUrl/coverUrl field. So the forms keep working exactly
// as they did (a URL in a text input), and a form submit stays small and cheap.

export async function POST(req: NextRequest) {
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

  // Which org's folder this is going into. Absent means RNL's own.
  const slug = String(form.get("partner") ?? "").trim();

  // ---- Who may write here -------------------------------------------
  //
  // The scope is decided by the GUARD, never by the form field. The field only
  // selects which guard runs; if it names a partner, you must hold write access
  // to THAT partner, and the directory we then write to is the slug the guard
  // approved — not the string the client sent. Same discipline as the roster
  // actions in actions/portal.ts.
  let scope: string;
  let actor: { robloxId: string; displayName: string };

  if (slug) {
    const partner = partnerBySlug(slug);
    if (!partner) {
      return NextResponse.json({ error: "Unknown partner." }, { status: 404 });
    }

    const access = await getPartnerAccess(partner.slug);
    if (!access || access.state !== "allowed" || !access.user.canWrite) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }

    scope = partner.slug;
    actor = {
      robloxId: access.user.robloxId,
      displayName: access.user.displayName,
    };
  } else {
    const user = await getCompanyUser();
    if (!user) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }

    scope = RNL_SCOPE;
    actor = { robloxId: user.robloxId, displayName: user.displayName };
  }

  // ---- The file itself ----------------------------------------------
  // Images only. This is the door for cover art and thumbnails — everything it
  // returns ends up in an <img src>, so it keeps taking images and nothing else,
  // even though the disk underneath now also holds PDFs. Brand assets have their
  // own door: api/uploads/brand.
  const saved = await saveUpload(file, scope, { accept: IMAGE_TYPES });
  if (!saved.ok) {
    const message =
      saved.error === "too-large"
        ? `That file is over ${Math.round((saved.limit ?? MAX_UPLOAD_BYTES) / 1024 / 1024)} MB.`
        : saved.error === "empty"
          ? "That file is empty."
          : "That isn't an image we accept (JPG, PNG, GIF, WebP or SVG).";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await prisma.mediaAsset.create({
    data: {
      partnerId: scope === RNL_SCOPE ? null : scope,
      url: saved.url,
      filename: saved.filename,
      mime: saved.mime,
      size: saved.size,
      uploadedById: actor.robloxId,
      uploadedByName: actor.displayName,
    },
  });

  return NextResponse.json({ url: saved.url });
}

import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import type { PartnerBriefAssetSlot } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/session";
import {
  ASSET_TYPES,
  BRIEF_SCOPE,
  PRIVATE_UPLOAD_DIR,
  resolveInRoot,
  savePrivateUpload,
} from "@/lib/uploads";
import { BRIEF_ASSET_SLOTS } from "@/lib/partner-brief";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Files going onto - and coming off - a partner's site brief.
//
// ---- Why a route handler and not a server action ---------------------------
//
// Server actions cap their request body at 1 MB. A logo is routinely more than that and a
// brand guideline PDF is twenty times it. The brand-asset door (api/uploads/brand) is a
// route for the same reason; this is its sibling with a completely different lock.
//
// ---- The lock is the TOKEN, and nothing else -------------------------------
//
// A brief is opened on a bearer link, by design (see the schema note on PartnerSiteBrief):
// the person who knows the brand is often not one of the Roblox logins on the account.
// So knowing the token is the authorisation to add files to that brief - exactly as
// knowing it is the authorisation to fill in the form - and there is deliberately no
// session check.
//
// What follows from that, and what MUST NOT be softened:
//
//   • The token names the brief. It is never taken from a `briefId` field, because a
//     briefId in the body would let anybody holding ONE valid token write into EVERY
//     brief.
//   • The scope is fixed. BRIEF_SCOPE is a constant here, so no request can choose the
//     directory it lands in.
//   • The disk is the PRIVATE one. These are unreleased brand assets; /uploads is served
//     by Caddy with no session in front of it.
//   • A missing or unknown token gets a flat 404, the same as a wrong one. There is
//     nothing useful to distinguish and nothing worth telling a prober.
//
// This route is on PROGRAMME_PATHS in the middleware so it is servable on the programme
// host, and under /api so the sign-in gate lets it past - which is precisely why the
// guarding above has to happen here. See the note on that list.

/** The cap for a brief attachment. Below lib/uploads.ts's per-type limits, never above. */
const MAX_FILES_PER_BRIEF = 24;

const isSlot = (v: string): v is PartnerBriefAssetSlot =>
  BRIEF_ASSET_SLOTS.some((s) => s.slot === v);

const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404 });

/**
 * The brief this token names, or null.
 *
 * Drafts and handed-in briefs alike: a SUBMITTED brief stays editable on purpose (see
 * PartnerSiteBriefStatus in the schema). It is a description, not a contract, and a
 * partner who spots a wrong hex the day after sending it should fix it rather than ask.
 */
async function briefFor(token: string) {
  if (!token) return null;
  return prisma.partnerSiteBrief.findUnique({
    where: { token },
    select: { id: true },
  });
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Malformed upload." }, { status: 400 });
  }

  const brief = await briefFor(String(form.get("token") ?? ""));
  if (!brief) return notFound();

  const slot = String(form.get("slot") ?? "");
  if (!isSlot(slot)) {
    return NextResponse.json({ error: "Unknown slot." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file." }, { status: 400 });
  }

  // A ceiling on the whole brief, not just this file. Without it the bearer link is an
  // unauthenticated write to RNL's disk that only stops when the disk does.
  const held = await prisma.partnerSiteBriefAsset.count({
    where: { briefId: brief.id },
  });
  if (held >= MAX_FILES_PER_BRIEF) {
    return NextResponse.json(
      { error: `That's ${MAX_FILES_PER_BRIEF} files already - plenty. Remove one first.` },
      { status: 400 },
    );
  }

  const saved = await savePrivateUpload(file, BRIEF_SCOPE, { accept: ASSET_TYPES });
  if (!saved.ok) {
    const message =
      saved.error === "too-large"
        ? `That file is over ${Math.round((saved.limit ?? 0) / 1024 / 1024)} MB.`
        : saved.error === "empty"
          ? "That file is empty."
          : "That isn't a file we accept (JPG, PNG, GIF, WebP, SVG or PDF).";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Attributed to whoever happened to be signed in, or to the link itself. Most of the
  // time it is the link: the whole point is that the holder need not have an account.
  const session = await getUserSession();

  const asset = await prisma.partnerSiteBriefAsset.create({
    data: {
      briefId: brief.id,
      slot,
      storagePath: saved.storagePath,
      filename: saved.filename,
      mime: saved.mime,
      size: saved.size,
      uploadedBy: session ? session.displayName : "brief link",
    },
  });

  return NextResponse.json({
    id: asset.id,
    slot: asset.slot,
    filename: asset.filename,
    mime: asset.mime,
    size: asset.size,
  });
}

/**
 * Take a file back off a brief.
 *
 * Same token lock, plus one extra condition that is easy to miss: the asset must belong
 * to the brief the token names. Deleting by id alone would let one valid token remove
 * every file in the system.
 *
 * The bytes go too. An orphaned file on the private volume is invisible - nothing lists
 * that directory - so it would sit there until somebody went looking, which nobody does.
 * The row is deleted first: if the unlink fails (a file already gone, a permission
 * problem), the brief is still correct and the worst outcome is one stray file, rather
 * than a file removed from disk with a row still pointing at it.
 */
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const brief = await briefFor(url.searchParams.get("token") ?? "");
  if (!brief) return notFound();

  const id = url.searchParams.get("id") ?? "";
  if (!id) return notFound();

  const asset = await prisma.partnerSiteBriefAsset.findFirst({
    where: { id, briefId: brief.id },
  });
  if (!asset) return notFound();

  await prisma.partnerSiteBriefAsset.delete({ where: { id: asset.id } });

  const target = resolveInRoot(PRIVATE_UPLOAD_DIR, asset.storagePath);
  if (target) await unlink(target).catch(() => {});

  return NextResponse.json({ ok: true });
}

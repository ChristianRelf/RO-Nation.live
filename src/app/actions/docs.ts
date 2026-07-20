"use server";

import { rm, stat } from "fs/promises";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AssetKind, AssetVisibility } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCompanyUser } from "@/lib/company";
import {
  ASSET_TYPES,
  PRIVATE_UPLOAD_DIR,
  UPLOAD_DIR,
  resolveInRoot,
} from "@/lib/uploads";
import {
  readGuideForm,
  resolvePublishedAt,
  s,
  uniqueSlug,
} from "@/lib/content";
import {
  AuditAction,
  AuditActorKind,
  AuditTarget,
  COMPANY_SCOPE,
  recordAudit,
} from "@/lib/audit";

// The docs are authored here - on the main site, from /company - and read on the
// portal host at /docs. Same Next app, two hosts; nothing about the write path
// cares which host the reader is on.
//
// Every action opens with requireCompanyUser(). Not one of them takes a partner
// scope: there is one docs library and it is RNL's, so there is no scope to get
// wrong. See the note on the Guide model in prisma/schema.prisma.

/**
 * One audit line for a docs write.
 *
 * COMPANY_SCOPE, not SHASHA. The docs library has no partnerId column at all -
 * there is one library and it is the company's - which is exactly the case that
 * scope is for. See lib/audit.ts: an RNL *event* is SHASHA's because it has a
 * partnerId that happens to be NULL; a guide has no such column and is the
 * company's outright.
 */
function logDocs(
  actor: { robloxId: string; displayName: string },
  input: {
    action: AuditAction;
    target: AuditTarget;
    targetId?: string;
    targetName: string;
    did: string;
  },
) {
  return recordAudit({
    scope: COMPANY_SCOPE,
    action: input.action,
    target: input.target,
    targetId: input.targetId,
    targetName: input.targetName,
    actor: {
      id: actor.robloxId,
      name: actor.displayName,
      kind: AuditActorKind.COMPANY,
    },
    summary: `${actor.displayName} ${input.did}`,
  });
}

function refreshGuides(slug?: string) {
  revalidatePath("/company/docs");
  revalidatePath("/company/docs/guides");
  // The reader's pages are all force-dynamic - they read a session cookie, so
  // they cannot be cached and there is nothing here to bust. These two lines are
  // here for the day one of them isn't.
  revalidatePath("/docs/guides");
  if (slug) revalidatePath(`/docs/guides/${slug}`);
}

export async function createGuide(formData: FormData) {
  const user = await requireCompanyUser();

  const data = readGuideForm(formData);
  if (!data.title || !data.body) {
    redirect("/company/docs/guides/new?error=required");
  }

  const slug = await uniqueSlug(data.title, "guide");
  const guide = await prisma.guide.create({
    data: {
      ...data,
      slug,
      publishedAt: resolvePublishedAt(data.status),
      authorRobloxId: user.robloxId,
      authorName: user.displayName,
    },
  });

  await logDocs(user, {
    action:
      data.status === "PUBLISHED" ? AuditAction.PUBLISHED : AuditAction.CREATED,
    target: AuditTarget.GUIDE,
    targetId: guide.id,
    targetName: guide.title,
    did: `${data.status === "PUBLISHED" ? "published" : "drafted"} the guide "${guide.title}"`,
  });

  refreshGuides(slug);
  redirect("/company/docs/guides");
}

export async function updateGuide(formData: FormData) {
  const user = await requireCompanyUser();

  const id = s(formData, "id");
  const data = readGuideForm(formData);
  if (!id || !data.title || !data.body) {
    redirect(`/company/docs/guides/${id}/edit?error=required`);
  }

  const existing = await prisma.guide.findUnique({ where: { id } });
  if (!existing) redirect("/company/docs/guides");

  // The slug is NOT re-derived from the new title. A guide's URL gets pasted into
  // a Discord on show night; retitling it must not rot that link.
  await prisma.guide.update({
    where: { id },
    data: {
      ...data,
      publishedAt: resolvePublishedAt(data.status, existing.publishedAt),
    },
  });

  await logDocs(user, {
    action:
      existing.status !== "PUBLISHED" && data.status === "PUBLISHED"
        ? AuditAction.PUBLISHED
        : AuditAction.UPDATED,
    target: AuditTarget.GUIDE,
    targetId: id,
    targetName: data.title,
    did:
      existing.status !== "PUBLISHED" && data.status === "PUBLISHED"
        ? `published the guide "${data.title}"`
        : `edited the guide "${data.title}"`,
  });

  refreshGuides(existing.slug);
  redirect("/company/docs/guides");
}

export async function deleteGuide(formData: FormData) {
  const user = await requireCompanyUser();

  const id = s(formData, "id");
  if (id) {
    const gone = await prisma.guide.delete({ where: { id } }).catch(() => null);

    // Only if the delete actually returned a row. The .catch above swallows a
    // missing id into null, and a line about deleting something that was not
    // there is a line that will be believed later.
    if (gone) {
      await logDocs(user, {
        action: AuditAction.DELETED,
        target: AuditTarget.GUIDE,
        targetId: id,
        targetName: gone.title,
        did: `deleted the guide "${gone.title}"`,
      });
    }

    refreshGuides(gone?.slug);
  }

  redirect("/company/docs/guides");
}

// ---- brand assets ------------------------------------------------

function refreshAssets() {
  revalidatePath("/company/docs");
  revalidatePath("/company/docs/assets");
  revalidatePath("/docs/brandassets");
}

/** "rnl/9f1c…-….pdf" and nothing else. */
const STORAGE_PATH_RE = /^[a-z0-9-]+\/[0-9a-f-]{36}\.[a-z0-9]+$/;

const ASSETS = "/company/docs/assets";

/** Validate the posted kind against the enum; anything junk files as an ASSET. */
function readAssetKind(value: string): AssetKind {
  return (Object.values(AssetKind) as string[]).includes(value)
    ? (value as AssetKind)
    : AssetKind.ASSET;
}

/**
 * Take a file the upload route has already written, and file it.
 *
 * The four fields describing that file - storagePath, filename, mime, size - come
 * back through the browser as hidden inputs, so they are forgeable. That is
 * tolerable (this caller already holds rank 245 and can write whatever they like
 * through this UI) but it is not a reason to store them unchecked:
 *
 *   • storagePath must match the shape this app generates, and must resolve INSIDE
 *     the root its visibility selects - so it can never name ../../.env.
 *   • the file must actually exist, and its size is read FROM DISK. A client's
 *     byte count is decoration.
 *   • mime is checked against the set the uploader accepts, because it is what
 *     app/files/[id] later sends as Content-Type.
 */
export async function createBrandAsset(formData: FormData) {
  const user = await requireCompanyUser();

  const title = s(formData, "title");
  const storagePath = s(formData, "storagePath");
  const mime = s(formData, "mime");
  const filename = s(formData, "filename").slice(0, 200);

  if (!title || !storagePath) redirect(`${ASSETS}?error=required`);
  if (!STORAGE_PATH_RE.test(storagePath) || !ASSET_TYPES.includes(mime)) {
    redirect(`${ASSETS}?error=file`);
  }

  const visibility =
    s(formData, "visibility") === "INTERNAL"
      ? AssetVisibility.INTERNAL
      : AssetVisibility.PUBLIC;

  const root =
    visibility === AssetVisibility.INTERNAL ? PRIVATE_UPLOAD_DIR : UPLOAD_DIR;
  const target = resolveInRoot(root, storagePath);
  if (!target) redirect(`${ASSETS}?error=file`);

  // The real size, from the real file. Also proves it is there - a row pointing
  // at nothing would render as a download link that 404s.
  let size: number;
  try {
    const info = await stat(target);
    if (!info.isFile()) redirect(`${ASSETS}?error=file`);
    size = info.size;
  } catch {
    redirect(`${ASSETS}?error=file`);
  }

  const asset = await prisma.brandAsset.create({
    data: {
      category: s(formData, "category") || "Logos",
      title,
      description: s(formData, "description") || null,
      kind: readAssetKind(s(formData, "kind")),
      visibility,
      storagePath,
      filename: filename || storagePath,
      mime,
      size,
      order: parseInt(s(formData, "order") || "0", 10) || 0,
      uploadedById: user.robloxId,
      uploadedByName: user.displayName,
    },
  });

  await logDocs(user, {
    action: AuditAction.CREATED,
    target: AuditTarget.ASSET,
    targetId: asset.id,
    targetName: asset.title,
    // Worth naming the visibility: an INTERNAL asset lives on a volume Caddy does
    // not mount and is reachable only through the gated /files route, so which of
    // the two somebody uploaded is the interesting half of the act.
    did: `uploaded the ${asset.visibility === AssetVisibility.INTERNAL ? "internal" : "public"} asset "${asset.title}"`,
  });

  refreshAssets();
  redirect(ASSETS);
}

/**
 * Metadata and order only.
 *
 * `visibility` is deliberately NOT editable, and the form shows it as a read-only
 * pill saying so. It decides which VOLUME the bytes are on, and the two are
 * different Docker volumes - so "changing" it is a copy across devices (fs.rename
 * throws EXDEV), and a half-finished one strands the file with a row that says it
 * is somewhere it isn't. To change it, re-upload it.
 */
export async function updateBrandAsset(formData: FormData) {
  const user = await requireCompanyUser();

  const id = s(formData, "id");
  const title = s(formData, "title");
  if (!id || !title) redirect(`${ASSETS}?error=required`);

  await prisma.brandAsset.update({
    where: { id },
    data: {
      category: s(formData, "category") || "Logos",
      title,
      description: s(formData, "description") || null,
      // Metadata only - kind just re-files it between the two reader pages, it does
      // not touch which volume the bytes are on (that is visibility, which stays
      // fixed). So unlike visibility, this is safe to change after upload.
      kind: readAssetKind(s(formData, "kind")),
      order: parseInt(s(formData, "order") || "0", 10) || 0,
    },
  });

  await logDocs(user, {
    action: AuditAction.UPDATED,
    target: AuditTarget.ASSET,
    targetId: id,
    targetName: title,
    did: `edited the asset "${title}"`,
  });

  refreshAssets();
  redirect(ASSETS);
}

export async function deleteBrandAsset(formData: FormData) {
  const user = await requireCompanyUser();

  const id = s(formData, "id");
  if (!id) redirect(ASSETS);

  const asset = await prisma.brandAsset.findUnique({ where: { id } });
  if (!asset) redirect(ASSETS);

  // INTERNAL: delete the bytes as well. A gated file that nothing lists is
  // exactly the file you want gone - nobody can find it to clean it up later, and
  // it is the kind of file (an unreleased poster, a guideline draft) whose whole
  // value was that it was not lying around.
  //
  // PUBLIC: keep the bytes, and keep the MediaAsset row. That URL is shareable BY
  // DESIGN and is already in a Discord message and somebody's slide deck. Removing
  // the row takes it off the docs page, which is what "delete" means here.
  // Deleting the file would rot links we told people to share.
  if (asset.visibility === AssetVisibility.INTERNAL) {
    const target = resolveInRoot(PRIVATE_UPLOAD_DIR, asset.storagePath);
    if (target) await rm(target, { force: true }).catch(() => {});
  }

  await prisma.brandAsset.delete({ where: { id } });

  await logDocs(user, {
    action: AuditAction.DELETED,
    target: AuditTarget.ASSET,
    targetId: id,
    targetName: asset.title,
    // Says whether the bytes went too, because the two are different acts with
    // different consequences and the row is gone either way. See the note above.
    did:
      asset.visibility === AssetVisibility.INTERNAL
        ? `deleted the internal asset "${asset.title}" and its file`
        : `removed the public asset "${asset.title}" from the docs (its file is kept)`,
  });

  refreshAssets();
  redirect(ASSETS);
}

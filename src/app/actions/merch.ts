"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCompanyUser } from "@/lib/company";
import { s } from "@/lib/content";
import { collectionBySlug } from "@/lib/merch/collections";
import { merchRoute } from "@/lib/merch/urls";
import { runMerchSync } from "@/lib/merch/sync";

// The shop is authored here - on the main site, from /company - and read on the
// merch host. Same Next app, two hosts.
//
// Every action opens with requireCompanyUser(). None of them takes a partner scope:
// the shop is RNL's group's store, so there is no scope to get wrong. A collection
// may WEAR a partner's brand (/sleeptoken), but it is still RNL's shelf and RNL's
// merch - borrowing a palette is not co-ownership.

function refreshMerch(collection?: string | null, slug?: string) {
  revalidatePath("/company/merch");
  // The INTERNAL paths, always. The shop's public URLs (/sleeptoken/…) match no
  // route in this app - the middleware rewrites them onto /merch - so revalidating
  // one of those would match nothing, throw nothing, and quietly leave a sold-out
  // shirt on the shelf. See lib/merch/urls.ts.
  revalidatePath(merchRoute());
  if (collection) revalidatePath(merchRoute(`/${collection}`));
  if (collection && slug) revalidatePath(merchRoute(`/${collection}/${slug}`));
}

/**
 * Pull the group's store into the database.
 *
 * The guard and the redirect live here; the work lives in lib/merch/sync.ts, which
 * never deletes and never overwrites a curated field. Split that way so the sync can
 * be exercised from a script against the real API and the real database - testing
 * the code that actually runs, rather than a copy of it that is free to drift.
 */
export async function syncMerch() {
  await requireCompanyUser();

  const result = await runMerchSync();

  // null means "Roblox did not answer", which is emphatically NOT "the group sells
  // nothing". Nothing was written: with no data, the correct number of rows to
  // change is zero.
  if (!result) {
    redirect("/company/merch?error=unreachable");
  }

  refreshMerch();
  redirect(
    `/company/merch?synced=${result.added + result.updated}` +
      `&added=${result.added}&skipped=${result.skipped}&failed=${result.failed}`,
  );
}

/** Place a product on a shelf: collection, order, visibility, texture. */
export async function updateMerchProduct(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  if (!id) redirect("/company/merch?error=missing");

  const before = await prisma.merchProduct.findUnique({
    where: { id },
    select: { collection: true, slug: true },
  });
  if (!before) redirect("/company/merch?error=missing");

  // Validated against the registry, not stored as typed. A collection that names no
  // shelf is a product with a URL that 404s - visible in the admin, invisible on the
  // site, and no error anywhere to say why. "" means deliberately unplaced.
  const raw = s(formData, "collection");
  const collection = raw ? (collectionBySlug(raw)?.slug ?? null) : null;
  if (raw && !collection) redirect("/company/merch?error=collection");

  // The private storage path of the clothing template - "rnl/<uuid>.png", handed back
  // by /api/uploads/texture. Never a URL, and the shape is enforced rather than
  // trusted: the field is a hidden input, so anything that is not exactly what that
  // route minted got there by somebody editing the DOM.
  //
  // It matters because this value is later joined onto a filesystem root and opened.
  // resolveInRoot() in lib/uploads.ts is the lock on that door and it holds on its own
  // - but a column that can only ever contain a UUID is a column no traversal can be
  // smuggled through in the first place, and the two together are what let plate.ts
  // read from disk without thinking about it.
  //
  // The extension is not pinned to .png even though the upload route now only accepts
  // one: templates migrated off the public volume by scripts/privatise-textures.ts keep
  // whatever extension they were sniffed as years ago, and re-saving one of those rows
  // from this form must not reject a file that is already on disk and working.
  const submitted = s(formData, "texturePath");
  const texturePath = /^[a-z0-9-]+\/[0-9a-f-]{36}\.(png|jpe?g|webp|gif)$/i.test(submitted)
    ? submitted
    : null;
  if (submitted && !texturePath) redirect("/company/merch?error=texture");

  await prisma.merchProduct.update({
    where: { id },
    data: {
      collection,
      order: parseInt(s(formData, "order") || "0", 10) || 0,
      // An unplaced product cannot be visible: there is no page for it to be visible
      // on. Enforced here rather than trusted from the checkbox, so the database
      // cannot hold a state the site is unable to render.
      visible: collection ? formData.get("visible") === "on" : false,
      texturePath,
      // Belt and braces on the deploy that moved the artwork off the public volume: any
      // product saved from the admin gets its dead public URL cleared, whether or not
      // the migration script has been run. See the column's note in schema.prisma.
      textureUrl: null,
    },
  });

  // Both shelves, because the product may have just moved between them and the one
  // it LEFT is now stale too - the shirt would linger on its old page until
  // something else evicted it.
  refreshMerch(before.collection, before.slug);
  refreshMerch(collection, before.slug);
  redirect("/company/merch?saved=1");
}

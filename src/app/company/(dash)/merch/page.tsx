import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { AdminHeader, StatCard } from "@/components/admin-ui";
import { UploadField } from "@/components/upload-field";
import { requireCompanyUser } from "@/lib/company";
import { activeCollections } from "@/lib/merch/collections";
import { merchOrigin, productPath, robloxCatalogUrl } from "@/lib/merch/urls";
import { syncMerch, updateMerchProduct } from "@/app/actions/merch";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Merch" };

// The authoring side of merch.ronation.live. Roblox owns half of every row here and
// RNL owns the other half - see the note on MerchProduct in prisma/schema.prisma.
// This page only ever writes RNL's half.

const messages: Record<string, string> = {
  unreachable:
    "Roblox didn't answer, so nothing was changed. Everything below is exactly as it was - try again in a minute.",
  collection: "That collection doesn't exist.",
  missing: "That product no longer exists.",
};

export default async function CompanyMerchPage({
  searchParams,
}: {
  searchParams: {
    synced?: string;
    added?: string;
    skipped?: string;
    failed?: string;
    error?: string;
    saved?: string;
  };
}) {
  await requireCompanyUser();

  const products = await prisma.merchProduct.findMany({
    orderBy: [{ collection: "asc" }, { order: "asc" }, { name: "asc" }],
  });
  const collections = activeCollections();

  const live = products.filter((p) => p.visible && p.collection).length;
  const unplaced = products.filter((p) => !p.collection).length;
  const untextured = products.filter((p) => !p.textureUrl).length;

  const error = searchParams.error ? messages[searchParams.error] : null;

  return (
    <div>
      <AdminHeader
        title="Merch"
        subtitle="The Roblox group's store, shown properly. Sync pulls names and prices from Roblox; everything else here is yours."
      />

      {error ? (
        <p className="mb-6 rounded-brand border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {searchParams.synced ? (
        <p className="mb-6 rounded-brand border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
          Synced {searchParams.synced} item
          {searchParams.synced === "1" ? "" : "s"} from Roblox
          {Number(searchParams.added) > 0 ? `, ${searchParams.added} new` : ""}
          {/* "Not clothing" is a permanent fact about the asset. Say so plainly, so
              nobody goes hunting for a decal that is never going to appear here. */}
          {Number(searchParams.skipped) > 0
            ? ` · ${searchParams.skipped} skipped (not clothing)`
            : ""}
          .
        </p>
      ) : null}

      {/* Kept SEPARATE from "skipped", and this is the whole reason the sync counts
          the two apart. An item Roblox failed to describe is not a decal - it is a
          shirt we did not manage to fetch, it is missing from the shop right now, and
          it will come back on the next sync. Reporting that as "not clothing" is how
          a product goes missing for a month with a cheerful green message explaining
          that everything is fine. */}
      {Number(searchParams.failed) > 0 ? (
        <p className="mb-6 rounded-brand border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-300">
          Roblox didn&apos;t answer for {searchParams.failed} item
          {searchParams.failed === "1" ? "" : "s"} - usually a rate limit. Nothing was
          changed for {searchParams.failed === "1" ? "it" : "them"}. Sync again in a
          minute and {searchParams.failed === "1" ? "it" : "they"} should come through.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="On the shop" value={live} hint={`${products.length} synced`} />
        <StatCard label="Unplaced" value={unplaced} hint="no collection = not shown" />
        <StatCard label="No texture" value={untextured} hint="falls back to a flat image" />
      </div>

      <form action={syncMerch} className="mt-8">
        {/* btn-accent, not btn-primary: there is no .btn-primary in globals.css and
            there never was, so this button was rendering with no background at all. */}
        <button type="submit" className="btn btn-accent">
          Sync now
        </button>
        <span className="ml-3 text-xs text-faint">
          Reads the Roblox group store. Never removes anything.
        </span>
      </form>

      {products.length === 0 ? (
        <p className="mt-10 rounded-brand border border-dashed border-line px-6 py-10 text-center text-sm text-muted">
          Nothing synced yet. Hit <strong className="text-fg">Sync now</strong> to pull
          the group&apos;s clothing in.
        </p>
      ) : null}

      <div className="mt-10 space-y-4">
        {products.map((p) => (
          <form
            key={p.id}
            action={updateMerchProduct}
            className="card flex flex-col gap-5 p-5 lg:flex-row lg:items-start"
          >
            <input type="hidden" name="id" value={p.id} />

            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.thumbnailUrl ? (
              <img
                src={p.thumbnailUrl}
                alt=""
                className="h-24 w-24 shrink-0 rounded-brand border border-line bg-bg object-contain"
              />
            ) : (
              <div className="grid h-24 w-24 shrink-0 place-items-center rounded-brand border border-dashed border-line text-[10px] text-faint">
                No image
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-fg">{p.name}</p>
                <span className="rounded-brand border border-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-faint">
                  {p.kind}
                </span>
                {p.forSale ? (
                  <span className="text-sm font-semibold text-accent">
                    R$ {p.priceRobux ?? "-"}
                  </span>
                ) : (
                  <span className="rounded-brand border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-300">
                    Off sale
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs text-faint">
                <a
                  href={robloxCatalogUrl(p.assetId, p.name)}
                  target="_blank"
                  rel="noreferrer"
                  className="link-underline hover:text-fg"
                >
                  {p.assetId} ↗
                </a>
                {p.visible && p.collection ? (
                  <>
                    {" · "}
                    <a
                      href={`${merchOrigin()}${productPath(p.collection, p.slug)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="link-underline hover:text-fg"
                    >
                      live ↗
                    </a>
                  </>
                ) : null}
              </p>

              <div className="mt-4 flex flex-wrap items-end gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-fg">
                    Collection
                  </label>
                  <select
                    name="collection"
                    defaultValue={p.collection ?? ""}
                    className="rounded-brand border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                  >
                    <option value="">- unplaced -</option>
                    {collections.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-fg">
                    Order
                  </label>
                  <input
                    type="number"
                    name="order"
                    defaultValue={p.order}
                    className="w-20 rounded-brand border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </div>

                <label className="flex items-center gap-2 pb-2.5 text-sm text-muted">
                  <input
                    type="checkbox"
                    name="visible"
                    defaultChecked={p.visible}
                    className="h-4 w-4 accent-accent"
                  />
                  Show on the shop
                </label>

                <button type="submit" className="btn btn-ghost !py-2 !px-4 text-sm">
                  Save
                </button>
              </div>

              <div className="mt-5 border-t border-line pt-4">
                <UploadField
                  name="textureUrl"
                  label="Clothing template (the 3D viewer)"
                  defaultValue={p.textureUrl}
                  hint="The classic 585×559 template PNG you uploaded to Roblox. Roblox won't give us this file, so it has to come from you - without it the page shows Roblox's flat image instead of a character."
                />
              </div>
            </div>
          </form>
        ))}
      </div>
    </div>
  );
}

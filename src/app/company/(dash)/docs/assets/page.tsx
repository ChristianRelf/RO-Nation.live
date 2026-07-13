import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin-ui";
import { ConfirmButton } from "@/components/confirm-button";
import { BrandAssetForm } from "@/components/brand-asset-form";
import { createBrandAsset, deleteBrandAsset } from "@/app/actions/docs";
import { assetCategories, brandAssetsByCategory, brandAssetHref } from "@/lib/docs";
import { formatBytes } from "@/lib/format";
import { requireCompanyUser } from "@/lib/company";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Brand assets" };

export default async function CompanyAssetsPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  await requireCompanyUser();

  const [groups, categories] = await Promise.all([
    brandAssetsByCategory(),
    assetCategories(),
  ]);

  return (
    <div>
      <AdminHeader
        title="Brand assets"
        subtitle="Listed at portal.ronation.live/docs/brandassets. Public assets have a shareable URL; internal ones are only served to a signed-in reader."
      />

      <BrandAssetForm
        action={createBrandAsset}
        categories={categories}
        error={searchParams.error}
      />

      {groups.length ? (
        <div className="mt-10 space-y-8">
          {groups.map((g) => (
            <section key={g.category}>
              <h2 className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
                {g.category}
              </h2>

              <div className="mt-3 divide-y divide-line border-y border-line">
                {g.assets.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-4 py-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {a.title}
                        <span
                          className={`ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            a.visibility === "INTERNAL"
                              ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                              : "border-line text-faint"
                          }`}
                        >
                          {a.visibility}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-faint">
                        {a.filename} · {a.mime} · {formatBytes(a.size)} · #
                        {a.order}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                      <a
                        href={brandAssetHref(a)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted hover:text-fg"
                      >
                        Open
                      </a>
                      <form action={deleteBrandAsset}>
                        <input type="hidden" name="id" value={a.id} />
                        <ConfirmButton
                          className="text-faint hover:text-red-400"
                          message={
                            a.visibility === "INTERNAL"
                              ? `Delete "${a.title}"? The file is deleted too.`
                              : `Delete "${a.title}"? It comes off the docs page, but the file stays where it is — its URL may already have been shared.`
                          }
                        >
                          Delete
                        </ConfirmButton>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="mt-10 text-sm text-muted">
          Nothing uploaded yet.
        </p>
      )}
    </div>
  );
}

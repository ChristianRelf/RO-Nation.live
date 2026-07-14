import type { Metadata } from "next";
import { requireDocsReader } from "@/lib/docs-guard";
import { brandAssetsByCategory } from "@/lib/docs";
import { AssetCard } from "@/components/asset-card";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Brand assets" };

export default async function DocsBrandAssetsPage() {
  await requireDocsReader();

  const groups = await brandAssetsByCategory();

  return (
    <div>
      <header className="max-w-2xl">
        <h1 className="display text-4xl sm:text-5xl">Brand assets</h1>
        <p className="mt-4 text-sm text-muted">
          Logos, artwork and the guidelines. Anything marked{" "}
          <span className="font-semibold text-fg">internal</span> is served only to
          somebody signed in here - its link will not work for anybody else, so
          send the file, not the URL.
        </p>
      </header>

      {groups.length ? (
        <div className="mt-10 space-y-10">
          {groups.map((g) => (
            <section key={g.category}>
              <h2 className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
                {g.category}
              </h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {g.assets.map((a) => (
                  <AssetCard key={a.id} asset={a} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="card mt-10 grid place-items-center px-6 py-20 text-center">
          <p className="font-display text-2xl">Nothing here yet</p>
          <p className="mt-2 text-sm text-muted">
            The logos and guidelines are on their way up.
          </p>
        </div>
      )}
    </div>
  );
}

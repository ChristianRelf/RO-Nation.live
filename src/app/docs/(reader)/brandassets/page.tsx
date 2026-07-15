import type { Metadata } from "next";
import { requireDocsReader } from "@/lib/docs-guard";
import { brandLibraryGroups } from "@/lib/docs";
import { AssetViewer } from "@/components/asset-viewer";
import { DocsEmpty } from "@/components/docs-empty";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Brand assets" };

export default async function DocsBrandAssetsPage() {
  await requireDocsReader();

  const groups = await brandLibraryGroups();

  return (
    <div>
      <header className="max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
          The brand
        </p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Brand assets</h1>
        <p className="mt-4 text-sm text-muted">
          Logos, artwork and the guidelines - shown in place, so a PDF opens right
          here. Anything marked{" "}
          <span className="font-semibold text-fg">internal</span> is served only to
          somebody signed in here; its link won&rsquo;t work for anybody else, so
          send the file, not the URL.
        </p>
      </header>

      {groups.length ? (
        <div className="mt-10 space-y-12">
          {groups.map((g) => (
            <section key={g.category}>
              <h2 className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
                {g.category}
              </h2>
              <div className="mt-4 space-y-5">
                {g.assets.map((a) => (
                  <AssetViewer key={a.id} asset={a} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <DocsEmpty
          title="Nothing here yet"
          body="The logos and guidelines are on their way up."
        />
      )}
    </div>
  );
}

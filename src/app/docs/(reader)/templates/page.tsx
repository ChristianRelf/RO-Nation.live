import type { Metadata } from "next";
import { requireDocsReader } from "@/lib/docs-guard";
import { templateGroups } from "@/lib/docs";
import { AssetViewer } from "@/components/asset-viewer";
import { DocsEmpty } from "@/components/docs-empty";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Templates & downloads" };

// The downloads area. Same file machinery as the brand library - same upload
// path, same viewer, same PUBLIC/INTERNAL split - filtered to kind TEMPLATE, so a
// run sheet or a config sits somewhere other than the logos without a second
// system to maintain.

export default async function DocsTemplatesPage() {
  await requireDocsReader();

  const groups = await templateGroups();

  return (
    <div>
      <header className="max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
          Reusable
        </p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Templates &amp; downloads</h1>
        <p className="mt-4 text-sm text-muted">
          The files you copy from rather than read: run sheets, checklists you print,
          spreadsheets, starter configs. Preview one in place, then grab it.
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
          title="No templates yet"
          body="Run sheets, checklists and starter files will land here as they are made."
        />
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { requireDocsReader } from "@/lib/docs-guard";
import { publishedGuidesBySection } from "@/lib/docs";
import { GuideIndex } from "@/components/guide-index";
import { DocsEmpty } from "@/components/docs-empty";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Guides" };

export default async function DocsGuidesPage() {
  await requireDocsReader();

  // Published only, kind GUIDE - the filter lives in lib/docs.ts, because it is the
  // one thing standing between an unfinished guide and every reader on the platform.
  const sections = await publishedGuidesBySection("GUIDE");

  return (
    <div>
      <header className="max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
          Reference
        </p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Guides</h1>
        <p className="mt-4 text-sm text-muted">
          How a show actually runs, and how to drive the systems that run it.
        </p>
      </header>

      {sections.length ? (
        <GuideIndex sections={sections} />
      ) : (
        <DocsEmpty
          title="Nothing here yet"
          body="The first guides are being written. Check back before your next show."
        />
      )}
    </div>
  );
}

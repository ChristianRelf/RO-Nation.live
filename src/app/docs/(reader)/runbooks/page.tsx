import type { Metadata } from "next";
import { requireDocsReader } from "@/lib/docs-guard";
import { publishedGuidesBySection } from "@/lib/docs";
import { GuideIndex } from "@/components/guide-index";
import { DocsEmpty } from "@/components/docs-empty";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Runbooks & playbooks" };

// Step-by-step operational procedures - the thing you open DURING a show, not
// before it. Same Guide model, filtered to kind RUNBOOK.

export default async function DocsRunbooksPage() {
  await requireDocsReader();

  const sections = await publishedGuidesBySection("RUNBOOK");

  return (
    <div>
      <header className="max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
          When it matters
        </p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Runbooks &amp; playbooks</h1>
        <p className="mt-4 text-sm text-muted">
          The procedures you follow with the clock running: show-day setup, the door,
          a scanner that died mid-queue, a refund, a deploy. Numbered steps, in order,
          for the moment you don&rsquo;t want to be thinking from scratch.
        </p>
      </header>

      {sections.length ? (
        <GuideIndex sections={sections} />
      ) : (
        <DocsEmpty
          title="No runbooks yet"
          body="Show-day and incident procedures will be written up here."
        />
      )}
    </div>
  );
}

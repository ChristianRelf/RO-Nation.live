import type { Metadata } from "next";
import { requireDocsReader } from "@/lib/docs-guard";
import { publishedGuidesBySection } from "@/lib/docs";
import { GuideIndex } from "@/components/guide-index";
import { DocsEmpty } from "@/components/docs-empty";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Onboarding & checklists" };

// The starting path for new crew. Same Guide model, kind ONBOARDING - and because
// the reader renders GitHub-flavoured markdown, a `- [ ]` line becomes a real
// checklist item on the page, which is exactly the shape onboarding wants.

export default async function DocsOnboardingPage() {
  await requireDocsReader();

  const sections = await publishedGuidesBySection("ONBOARDING");

  return (
    <div>
      <header className="max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
          Start here
        </p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Onboarding &amp; checklists</h1>
        <p className="mt-4 text-sm text-muted">
          New to the crew? Start here. The path from &ldquo;I have a door&rdquo; to
          running your first show, with checklists you can work through - your first
          key, your first event, the door on the night.
        </p>
      </header>

      {sections.length ? (
        <GuideIndex sections={sections} />
      ) : (
        <DocsEmpty
          title="Onboarding is being written"
          body="The getting-started path and its checklists will appear here."
        />
      )}
    </div>
  );
}

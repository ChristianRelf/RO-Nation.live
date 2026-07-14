import Link from "next/link";
import type { Metadata } from "next";
import { requireDocsReader } from "@/lib/docs-guard";
import { publishedGuidesBySection } from "@/lib/docs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Guides" };

export default async function DocsGuidesPage() {
  await requireDocsReader();

  // Published only - the filter lives in lib/docs.ts, because it is the one thing
  // standing between an unfinished guide and every reader on the platform.
  const sections = await publishedGuidesBySection();

  return (
    <div>
      <header className="max-w-2xl">
        <h1 className="display text-4xl sm:text-5xl">Guides</h1>
        <p className="mt-4 text-sm text-muted">
          How a show actually runs, and how to drive the systems that run it.
        </p>
      </header>

      {sections.length ? (
        <div className="mt-10 space-y-10">
          {sections.map((s) => (
            <section key={s.section}>
              <h2 className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
                {s.section}
              </h2>
              <div className="mt-4 divide-y divide-line border-y border-line">
                {s.guides.map((g) => (
                  <Link
                    key={g.id}
                    href={`/docs/guides/${g.slug}`}
                    className="block py-4 transition-colors hover:bg-fg/[0.02]"
                  >
                    <p className="font-medium">{g.title}</p>
                    {g.excerpt ? (
                      <p className="mt-1 text-sm text-muted">{g.excerpt}</p>
                    ) : null}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="card mt-10 grid place-items-center px-6 py-20 text-center">
          <p className="font-display text-2xl">Nothing here yet</p>
          <p className="mt-2 text-sm text-muted">
            The first guides are being written. Check back before your next show.
          </p>
        </div>
      )}
    </div>
  );
}

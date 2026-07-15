import Link from "next/link";
import type { Guide } from "@prisma/client";

// The grouped list of entries an area's index shows - Guides, Runbooks and
// Onboarding all draw the identical shape (a kicker per section, a linked row per
// entry), so they share this rather than each keeping their own copy to drift.
//
// Every entry links to /docs/guides/<slug>: slugs are globally unique across all
// kinds (one library), so there is one reader route, and it works out which area
// to send you "back" to from the guide's own kind. See docs/(reader)/guides/[slug].

export function GuideIndex({
  sections,
}: {
  sections: { section: string; guides: Guide[] }[];
}) {
  return (
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
  );
}

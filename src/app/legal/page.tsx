import type { Metadata } from "next";
import Link from "next/link";
import { Kicker } from "@/components/ui";
import { legalGroups } from "@/lib/legal";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Policies",
  description:
    "Every policy RO. Nation LIVE publishes: privacy, terms, code of conduct, and the Roblox and Discord sign-in documents.",
};

// The index that was missing.
//
// Seven legal documents existed and there was no way to see that they did. The footer
// linked three of them; the OAuth ones were reachable only by cross-links from each other,
// which meant the four documents Roblox and Discord were handed at registration were, on
// this site, effectively unlisted.
//
// ---- This page renders on EVERY host --------------------------------------
//
// "/legal" is in PORTAL_PATHS, SURVEY_PATHS, AUTHORISE_PATHS, PARTNER_PATHS *and*
// MERCH_PATHS (src/middleware.ts). So it is served, unrewritten, on the main site, the
// portal, the survey host, the shop, the authorise host, and every partner's domain.
//
// That is a real constraint on the design, not a footnote. It must not carry a "back to
// the shop" link, or a "back to the site" link, or anything else that assumes which of six
// hosts a reader arrived from - four of the six would be wrong. So: no breadcrumb, no
// home link, no navigation of any kind beyond the documents themselves, and nothing but
// design-system tokens, so it repaints in a partner's brand without knowing it did.
// The <LegalDoc> pages already work exactly this way.

export default function LegalIndexPage() {
  const groups = legalGroups();

  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-64" />

      <div className="shell relative pt-16 sm:pt-20">
        <Kicker>The small print</Kicker>
        <h1 className="display mt-5 text-5xl sm:text-6xl md:text-7xl">Policies</h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Everything we publish about how this works, what we hold, and what we owe
          each other. Written to be read, not to be scrolled past.
        </p>
      </div>

      <div className="shell py-14">
        {groups.map((g) => (
          <section key={g.group} className="mt-12 first:mt-0">
            <h2 className="kicker">{g.group}</h2>

            {g.group === "Integrations" ? (
              <p className="mt-3 max-w-2xl text-sm text-muted">
                These are the documents Roblox and Discord were given when the sign-in
                apps were registered. If you have signed in with either, they apply to
                you.
              </p>
            ) : null}

            <div className="mt-6 divide-y divide-line border-y border-line">
              {g.docs.map((d) => (
                <Link
                  key={d.href}
                  href={d.href}
                  className="group flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-5 transition-colors"
                >
                  <span className="min-w-0">
                    <span className="font-display text-2xl transition-colors group-hover:text-accent">
                      {d.title}
                    </span>
                    <span className="mt-1 block max-w-xl text-muted">{d.blurb}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
                    Updated {d.updated}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <p className="mt-14 max-w-2xl text-sm text-faint">
          Something here unclear, or something you think is wrong? Say so -{" "}
          <a
            href={`mailto:${site.contactEmail}`}
            className="link-underline text-muted transition-colors hover:text-fg"
          >
            {site.contactEmail}
          </a>
          . A policy nobody understands is not protecting anybody.
        </p>
      </div>
    </div>
  );
}

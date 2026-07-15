import type { Metadata } from "next";
import Link from "next/link";
import { AssetCard } from "@/components/asset-card";
import { Reveal } from "@/components/reveal";
import { Kicker, SectionHeading } from "@/components/ui";
import { publicBrandAssetsByCategory } from "@/lib/docs";
import { formatDate } from "@/lib/format";
import { getPublishedPosts } from "@/lib/queries";
import { site } from "@/lib/site";
import { getSiteStats, statTiles } from "@/lib/stats";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Press",
  description:
    "Press kit for RO. Nation LIVE: boilerplate, the numbers, logos and brand assets, and who to contact.",
  alternates: { canonical: "/press" },
};

// The press kit.
//
// ---- Why this page can exist at all ---------------------------------------
//
// Two things had to be true first, and until recently neither was.
//
// The NUMBERS had to be countable. The homepage used to claim "40+ shows produced" and
// "120K+ seats filled" out of nothing, and a press page is the one place where an invented
// figure does real damage - a journalist repeats it, and now RNL has lied in print. Every
// number here comes from lib/stats.ts, which counts rows. A stat that cannot be counted is
// not softened, it is ABSENT.
//
// The ASSETS had to have somewhere to live. BrandAsset.visibility = PUBLIC has existed all
// along, and the schema says exactly what it is for - "a shareable URL is the FEATURE here,
// a partner pasting a logo link into a Discord is the entire point" - but the only page
// that ever listed one was behind a staff login. The flag was shipped and pointed at
// nothing. This is the home it was built for.
//
// ---- There is deliberately no form on this page ---------------------------
//
// /contact requires a Roblox sign-in to send, which is the right trade there (it blocks
// essentially all spam and costs a Roblox player one click). It is the WRONG trade for a
// journalist, who has no Roblox account and no reason to make one. So the press gets an
// email address - the oldest, most reliable channel there is - and the form is one link
// away for anybody who would rather use it.

export default async function PressPage() {
  const [stats, groups, posts] = await Promise.all([
    getSiteStats(),
    publicBrandAssetsByCategory(),
    getPublishedPosts(null, 4),
  ]);

  const tiles = statTiles(stats);

  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-64" />

      <div className="shell relative pt-16 sm:pt-20">
        <Kicker>For the press</Kicker>
        <h1 className="display mt-5 text-5xl sm:text-6xl md:text-7xl">
          Press kit
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Everything you need to write about us: the boilerplate, the numbers, the
          logos, and a human to email.
        </p>
      </div>

      {/* ---- BOILERPLATE ---- */}
      <section className="shell py-14">
        <SectionHeading kicker="The boilerplate" title="Who we are" />
        <div className="mt-8 max-w-3xl">
          <p className="text-lg leading-relaxed text-fg">{site.boilerplate}</p>
          <p className="mt-5 text-sm text-faint">
            Copy that as-is. It is deliberately free of figures - the ones below are
            counted live, so they never go stale.
          </p>
        </div>
      </section>

      {/* ---- THE NUMBERS ---- */}
      {tiles.length >= 2 ? (
        <section className="border-y border-line bg-elev">
          <div className="shell py-14">
            <SectionHeading kicker="Checkable" title="By the numbers" />
            <div className="mt-8 grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4">
              {tiles.map((t) => (
                <div key={t.label} className="bg-bg px-4 py-8 text-center">
                  <div className="font-display text-4xl tnum text-fg">
                    {t.value}
                  </div>
                  <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                    {t.label}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 max-w-2xl text-sm text-muted">
              Every one of these is counted, not estimated. Shows are published events
              that have already happened; check-ins are people scanned through a door;
              merch is Roblox&apos;s own sales figure from our group store, which you
              can verify in the catalogue yourself. We do not print a number we cannot
              count.
            </p>
          </div>
        </section>
      ) : null}

      {/* ---- THE BRAND KIT ---- */}
      {/* Renders nothing at all when there are no public assets - the MerchStrip rule. A
          heading reading "Logos and artwork" above an empty grid is a promise the page
          immediately breaks. */}
      {groups.length ? (
        <section className="shell py-14">
          <SectionHeading
            kicker="Download"
            title="Logos and artwork"
            action={{ label: "Usage rules", href: "#usage" }}
          />

          <div className="mt-8 space-y-10">
            {groups.map((g) => (
              <div key={g.category}>
                <h3 className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
                  {g.category}
                </h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {g.assets
                    // Belt and braces. publicBrandAssetsByCategory() already filters, and
                    // this is the same check again - because the cost of it is nothing and
                    // the cost of a future "let's just list them all" edit to that query is
                    // an internal brand guideline PDF on a public URL, permanently, in
                    // somebody's crawler.
                    .filter((a) => a.visibility === "PUBLIC")
                    .map((a, i) => (
                      <Reveal key={a.id} delay={i * 55}>
                        <AssetCard asset={a} />
                      </Reveal>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---- USAGE ---- */}
      <section id="usage" className="border-y border-line bg-elev scroll-mt-24">
        <div className="shell py-14">
          <SectionHeading kicker="Before you publish" title="Using the marks" />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              {
                t: "Don't redraw it",
                b: "Use the files above as they are. Don't recolour the mark, stretch it, add effects to it, or rebuild it in another typeface.",
              },
              {
                t: "Don't imply endorsement",
                b: "Using our logo to illustrate a story about us is fine. Using it in a way that suggests we sponsor, endorse or are involved in something is not.",
              },
              {
                t: "We're not Roblox",
                b: "RO. Nation LIVE is an independent group. It is not affiliated with, endorsed by, or connected to Roblox Corporation, and shouldn't be described as though it were.",
              },
            ].map((r, i) => (
              <Reveal key={r.t} delay={i * 70}>
                <div className="card h-full p-7">
                  <h3 className="font-display text-xl">{r.t}</h3>
                  <p className="mt-3 text-muted">{r.b}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---- ANNOUNCEMENTS ---- */}
      {posts.length ? (
        <section className="shell py-14">
          <SectionHeading
            kicker="On the record"
            title="Recent announcements"
            action={{ label: "All posts", href: "/blog" }}
          />
          <div className="mt-8 divide-y divide-line border-y border-line">
            {posts.map((p) => (
              <Link
                key={p.id}
                href={`/blog/${p.slug}`}
                className="group flex flex-wrap items-baseline justify-between gap-4 py-5 transition-colors hover:text-accent"
              >
                <span className="font-display text-xl">{p.title}</span>
                {p.publishedAt ? (
                  <span className="font-mono text-xs tnum text-faint">
                    {formatDate(p.publishedAt)}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---- CONTACT ---- */}
      <section className="shell py-20">
        <div className="panel-paper p-10 text-center sm:p-16">
          <h2 className="display text-5xl text-black sm:text-6xl">
            Talk to a human
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-black/70">
            Interviews, quotes, screenshots, access to a show - email us and you
            will get a person, not a form.
          </p>

          <a
            href={`mailto:${site.contactEmail}?subject=Press%20enquiry`}
            className="mt-8 inline-flex items-center gap-2 rounded-[3px] bg-black px-6 py-3 text-[12px] font-bold uppercase tracking-[0.09em] text-paper transition-colors hover:bg-accent hover:text-accent-ink"
          >
            {site.contactEmail}
          </a>

          <p className="mt-6 text-sm text-black/60">
            Prefer a form?{" "}
            <Link href="/contact?kind=press" className="underline">
              Use the contact page
            </Link>{" "}
            - it needs a Roblox sign-in, which is why the email is here.
          </p>
        </div>
      </section>
    </div>
  );
}

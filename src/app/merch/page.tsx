import Link from "next/link";
import { prisma } from "@/lib/db";
import { activeCollections } from "@/lib/merch/collections";
import { priceLabel } from "@/lib/merch/price";
import { site } from "@/lib/site";
import { Reveal } from "@/components/reveal";
import { Rail } from "@/components/shop/rail";
import { ProductCard } from "@/components/shop/product-card";
import { CollectionBanner } from "@/components/shop/collection-banner";
import { StockTicker } from "@/components/shop/stock-ticker";
import { EmptyHanger } from "@/components/shop/furniture";

export const dynamic = "force-dynamic";

// The merch table, at the back of the venue, open after the show.
//
// The index used to do no database read at all, which meant it structurally could not
// show a shirt: it was two text cards linking to two other pages. A merch table with
// no merch on it.

export default async function ShopIndex() {
  const collections = activeCollections();
  const slugs = collections.map((c) => c.slug);

  const [perCollection, counts] = await Promise.all([
    // Per collection, and NOT one `take: 24` ordered by collection: that starves the
    // second shelf the moment the first has 24 visible products, and the rail quietly
    // becomes all-BABYMETAL forever.
    Promise.all(
      slugs.map((slug) =>
        prisma.merchProduct.findMany({
          where: { collection: slug, visible: true },
          orderBy: [{ order: "asc" }, { name: "asc" }],
          take: 8,
        }),
      ),
    ),
    prisma.merchProduct.groupBy({
      by: ["collection"],
      where: { visible: true, collection: { in: slugs } },
      _count: { _all: true },
      _sum: { sales: true },
    }),
  ]);

  const statFor = (slug: string) => {
    const row = counts.find((c) => c.collection === slug);
    return { total: row?._count._all ?? 0, sold: row?._sum.sales ?? 0 };
  };

  // Interleave round-robin, so the rail is never one collection followed by another -
  // it should look like a rail somebody hung, not like two queries concatenated.
  const railItems: (typeof perCollection)[number] = [];
  const depth = Math.max(0, ...perCollection.map((r) => r.length));
  for (let i = 0; i < depth; i++) {
    for (const rows of perCollection) {
      if (rows[i]) railItems.push(rows[i]);
    }
  }

  const collectionName = (slug: string | null) =>
    collections.find((c) => c.slug === slug)?.name ?? "";

  const ticker = railItems
    .slice(0, 10)
    .map(
      (p) =>
        `${collectionName(p.collection)} · ${p.name} · ${priceLabel(p).toUpperCase()}`,
    );
  ticker.push("We take no money - Roblox does");

  return (
    <>
      <StockTicker items={ticker} />

      {/* ---------------- THE TABLE ---------------- */}
      <section className="shell grid gap-12 py-16 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div>
          <Reveal>
            <p className="kicker">Merch table &middot; open after the show</p>
          </Reveal>
          <Reveal delay={60}>
            <h1 className="display misprint mt-6 text-[16vw] leading-[0.86] sm:text-7xl md:text-8xl lg:text-[7.5rem]">
              Wear
              <br />
              the show
            </h1>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-8 max-w-md text-lg leading-relaxed text-muted">
              Roblox clothing from our shows and the acts we produce. Pull one off the
              rail, turn it round on a body, then pick it up on Roblox.
            </p>
          </Reveal>
        </div>

        {/* The price card: the only cream object above the fold, so it lands. The
            payment truth stops being footer sludge and becomes the most tactile thing
            on the page. */}
        <Reveal delay={140}>
          <div className="panel-paper relative -rotate-[0.6deg] p-7">
            <span
              aria-hidden
              className="tape-ink -left-5 -top-3"
              style={{ "--tape-rot": "-8deg" } as React.CSSProperties}
            />
            <span
              aria-hidden
              className="tape-ink -right-5 -top-2"
              style={{ "--tape-rot": "6deg" } as React.CSSProperties}
            />

            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-paper-ink/60">
              How this works
            </p>
            <ol className="mt-5 space-y-3 font-mono text-[13px] uppercase tracking-[0.04em] text-paper-ink">
              {[
                "Pick a shirt off the rail",
                "Turn it round on a body",
                "Buy it on Roblox",
              ].map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="tabular-nums text-paper-ink/45">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="mt-6 border-t border-paper-ink/20 pt-4 font-mono text-[11px] uppercase tracking-[0.08em] text-paper-ink/70">
              We take no money. Roblox does.
            </p>
          </div>
        </Reveal>
      </section>

      {/* ---------------- THE RAIL ---------------- */}
      {/* Immediately under the hero, so a phone arriving from a Discord link sees a
          shirt before the first flick is finished. */}
      {railItems.length ? (
        <Rail
          label="Everything on the rail"
          count={railItems.length}
          className="pb-6 pt-8"
        >
          {railItems.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              collection={p.collection as string}
              showCollection={collectionName(p.collection)}
            />
          ))}
        </Rail>
      ) : (
        <section className="shell py-10">
          <p className="kicker">Everything on the rail</p>
          <div className="rail-bar mt-4" aria-hidden />
          <div className="mt-6 flex items-start gap-8">
            {[0, 1, 2].map((i) => (
              <EmptyHanger key={i} className="opacity-40" />
            ))}
            <div className="panel-paper relative -rotate-1 p-5">
              <span
                aria-hidden
                className="tape-ink -left-4 -top-3"
                style={{ "--tape-rot": "-6deg" } as React.CSSProperties}
              />
              <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-paper-ink">
                Nothing on the rail yet
              </p>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-paper-ink/60">
                Check back before the next show
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ---------------- THE SHELVES ---------------- */}
      <section className="shell pb-20 pt-14">
        <p className="kicker">The rails</p>
        <div className="mt-8 grid gap-10 sm:grid-cols-2">
          {collections.map((c, i) => {
            const { total, sold } = statFor(c.slug);
            return (
              <Reveal key={c.slug} delay={i * 70}>
                <CollectionBanner
                  collection={c}
                  products={perCollection[i] ?? []}
                  total={total}
                  sold={sold}
                />
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ---------------- THE COUNTER ---------------- */}
      <section className="shell pb-24">
        <div className="rail-bar" aria-hidden />
        <div className="flex flex-col items-start gap-6 pt-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="display text-3xl sm:text-4xl">Where it&apos;s sold</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
              Every item on this table is sold on Roblox, from our group. We show it to
              you here; they take the Robux there.
            </p>
          </div>
          <a
            href={site.socials.roblox}
            className="btn btn-accent shrink-0"
            target="_blank"
            rel="noreferrer"
          >
            Our Roblox group &#8599;
          </a>
        </div>
      </section>
    </>
  );
}

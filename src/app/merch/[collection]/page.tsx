import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { collectionBySlug } from "@/lib/merch/collections";
import { Reveal } from "@/components/reveal";
import { ProductCard } from "@/components/shop/product-card";
import { CollectionDisclaimer } from "@/components/shop/shop-footer";
import { Docket } from "@/components/shop/docket";
import { EmptyHanger, RailBar, Stamp } from "@/components/shop/furniture";

// A rail: one collection, hung up.
//
// This route is also what gives the shop its own 404. Every unrecognised path on the
// merch host rewrites to /merch/<junk>, lands here, finds no collection and calls
// notFound() - which renders app/merch/not-found.tsx, in the shop's chrome, listing
// the rails that do exist.
//
// The PAGE does not decide the brand. The middleware already did, from the URL, before
// this rendered - that is what put data-brand on <html>, and it is why the Sleep Token
// rail arrives already wearing Sleep Token's gold, its Cormorant and its square
// corners, with no branch in this file.

export async function generateMetadata({
  params,
}: {
  params: { collection: string };
}): Promise<Metadata> {
  const collection = collectionBySlug(params.collection);
  if (!collection) return {};
  return { title: collection.name, description: collection.description };
}

/** Four to a rail on a wide screen, two on a tablet, one on a phone. */
const PER_RAIL = 4;

export default async function CollectionPage({
  params,
}: {
  params: { collection: string };
}) {
  const collection = collectionBySlug(params.collection);
  if (!collection) notFound();

  const products = await prisma.merchProduct.findMany({
    where: { collection: collection.slug, visible: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });

  const sold = products.reduce((n, p) => n + p.sales, 0);
  const kinds = Array.from(new Set(products.map((p) => p.kind)));

  // Chunked into rails, because each row hangs off its own bar.
  const rails: (typeof products)[] = [];
  for (let i = 0; i < products.length; i += PER_RAIL) {
    rails.push(products.slice(i, i + PER_RAIL));
  }

  return (
    <>
      <section className="relative overflow-hidden">
        {/* The wall behind the rail. When there is no hero image - which is true of
            every collection today - the name IS the wall: flyposted, overlapping,
            ghosted back. That makes the common path the handsome one, so nobody feels
            pressure to go and find a photograph. */}
        {collection.heroImageUrl ? (
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={collection.heroImageUrl}
              alt=""
              className="h-full w-full object-cover opacity-30 grayscale contrast-125"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg/60 to-bg" />
          </div>
        ) : (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex flex-col justify-center overflow-hidden"
          >
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className="display whitespace-nowrap text-[13vw] leading-[0.9] text-fg/[0.055]"
                style={{
                  transform: `rotate(${i % 2 ? -1.2 : 0.8}deg) translateX(${i % 3 === 0 ? "-4%" : i % 3 === 1 ? "-12%" : "-8%"})`,
                }}
              >
                {`${collection.name} ${collection.name} ${collection.name}`}
              </span>
            ))}
          </div>
        )}

        <div className="shell relative grid gap-12 py-20 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <Reveal>
              <p className="kicker">{collection.tagline}</p>
            </Reveal>
            <Reveal delay={60}>
              <h1 className="display misprint mt-5 text-[13vw] leading-[0.86] sm:text-6xl lg:text-8xl">
                {collection.name}
              </h1>
            </Reveal>
            <Reveal delay={110}>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted">
                {collection.description}
              </p>
            </Reveal>
          </div>

          {/* The job docket. This is where `sales` and `kind` - two fields the shop has
              never rendered - finally earn their keep, and it is what stops the column
              being empty for a collection with no photograph. */}
          <Reveal delay={150}>
            <Docket
              rows={[
                { label: "Rail", value: collection.slug.toUpperCase() },
                { label: "Stock", value: "Classic Roblox" },
                {
                  label: "Items",
                  value: products.length
                    ? String(products.length).padStart(2, "0")
                    : null,
                },
                {
                  label: "Forms",
                  value: kinds.length ? kinds.join(" · ") : null,
                },
                {
                  // Omitted rather than printed as 0 - "0 SOLD" is a fact nobody needs
                  // and it reads as a failure.
                  label: "Sold",
                  value: sold > 0 ? sold.toLocaleString("en-GB") : null,
                  loud: true,
                },
                { label: "Press", value: "RO. Nation LIVE" },
              ]}
            />
          </Reveal>
        </div>
      </section>

      {/* ---------------- THE RAILS ---------------- */}
      <section className="shell pb-10">
        {rails.length ? (
          rails.map((row, r) => (
            <div key={r} className="mb-16">
              <RailBar />
              {/* ProductCard renders an <li>, so this must be a <ul> and nothing may
                  sit between them. Reveal renders a <div>, which is why the entrance
                  animation is not used here - `ul > div > li` is invalid markup, and
                  the browser silently reparents it, which breaks the grid in a way
                  that looks like a CSS bug and is not one. */}
              <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {row.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    collection={collection.slug}
                  />
                ))}
              </ul>
            </div>
          ))
        ) : (
          // Not a dashed grey box. A merch table at 2am has empty hangers on it, and
          // that reads as "not yet" rather than as "this page is broken".
          <div>
            <RailBar />
            <div className="mt-8 flex flex-wrap items-start gap-10">
              {[0, 1, 2].map((i) => (
                <EmptyHanger key={i} className="opacity-40" />
              ))}
              <div className="panel-paper relative -rotate-1 p-6">
                <span
                  aria-hidden
                  className="tape-ink -left-4 -top-3"
                  style={{ "--tape-rot": "-6deg" } as React.CSSProperties}
                />
                <Stamp className="text-paper-ink">Nothing on this rail</Stamp>
                <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.08em] text-paper-ink/70">
                  Check back before the next show
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {collection.disclaimer ? (
        <div className="shell pb-10">
          <CollectionDisclaimer text={collection.disclaimer} />
        </div>
      ) : null}
    </>
  );
}

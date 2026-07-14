import { prisma } from "@/lib/db";
import { activeCollections } from "@/lib/merch/collections";
import { merchOrigin } from "@/lib/merch/urls";
import { Kicker } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { ProductCard } from "@/components/shop/product-card";
import { RailBar } from "@/components/shop/furniture";

// The merch table, on the main site's homepage.
//
// A rail of real shirts rather than a card that says "we have merch", because a link to
// a shop is an advertisement and four shirts with prices on them is the shop. It is the
// same <ProductCard> the shop itself hangs - same hooks, same swing tags, same hang
// jitter - so the homepage is showing you the actual thing rather than a picture of it,
// and there is only one card to maintain.
//
// ---- Two things it has to get right, both about the host ----------------------
//
// 1. Every product link is ABSOLUTE. A product's public path (/babymetal/pentagram-tee)
//    is a URL on merch.ronation.live and does not exist on ronation.live - the
//    middleware hands over /merch and /shop and nothing else - so a relative link from
//    here would 404. ProductCard takes `origin` for exactly this.
// 2. The section-level links are RELATIVE (/merch). The middleware redirects those, so
//    one path works on the live site and in local dev, where every host is one origin.
//
// ---- And one about data --------------------------------------------------------
//
// It renders NOTHING when there is nothing to sell. A section on the homepage announcing
// a shop, above an empty rail, is worse than no section at all - it is a promise the
// site immediately breaks.

export async function MerchStrip() {
  const collections = activeCollections();

  const products = await prisma.merchProduct.findMany({
    where: { visible: true, collection: { not: null } },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    take: 4,
  });

  if (!products.length) return null;

  const origin = merchOrigin();
  const nameOf = (slug: string | null) =>
    collections.find((c) => c.slug === slug)?.name ?? "";

  return (
    <section className="relative overflow-hidden border-y border-line bg-elev">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-40" />

      <div className="shell relative py-20 sm:py-24">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Reveal>
              <Kicker>The merch table</Kicker>
            </Reveal>
            <Reveal delay={60}>
              <h2 className="display mt-4 text-4xl text-fg sm:text-5xl md:text-6xl">
                Wear the show.
              </h2>
            </Reveal>
            <Reveal delay={110}>
              <p className="mt-5 max-w-md text-muted">
                Roblox clothing from our shows and the acts we produce. Turn it round on
                a body, then pick it up on Roblox - we don&apos;t take the money, they
                do.
              </p>
            </Reveal>
          </div>

          <Reveal delay={150}>
            {/* Relative: the middleware hands /merch over to the merch host. */}
            <a href="/merch" className="btn btn-accent shrink-0">
              Shop the merch
            </a>
          </Reveal>
        </div>

        <div className="mt-14">
          <RailBar />
          {/* ProductCard renders an <li>, so this must be a <ul> with nothing between
              them - Reveal renders a <div>, and `ul > div > li` is invalid markup that
              the browser silently reparents, which breaks the grid in a way that looks
              like a CSS bug and is not one. */}
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                collection={p.collection as string}
                showCollection={nameOf(p.collection)}
                origin={origin}
              />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import type { MerchProduct } from "@prisma/client";
import type { Collection } from "@/lib/merch/collections";
import { collectionPath } from "@/lib/merch/urls";
import { EmptyHanger, Hook } from "./furniture";

// A collection, as a banner hung off the bar with pegged shirts under it.
//
// The eyelets along its top edge are punched with a repeating mask (see .banner in
// globals.css), which means - as with the ticket and the swing tag - its shadow has to
// be a drop-shadow filter and never a box-shadow. A box-shadow is the shadow of the
// element's BOX; it would happily paint straight through the holes we just cut.

export function CollectionBanner({
  collection,
  products,
  total,
  sold,
}: {
  collection: Collection;
  /** Up to three, for the pegs. */
  products: MerchProduct[];
  total: number;
  sold: number;
}) {
  const line = total
    ? `${total} ${total === 1 ? "item" : "items"}${sold > 0 ? ` · ${sold.toLocaleString("en-GB")} sold` : ""}`
    : "Nothing on this rail yet";

  return (
    <Link
      href={collectionPath(collection.slug)}
      className="banner-link group block"
      aria-label={`${collection.name}. ${line}.`}
    >
      {/* The bar this one hangs from. */}
      <div className="rail-bar" aria-hidden />

      <div className="banner card relative overflow-hidden px-6 pb-6 pt-9 sm:px-8 sm:pb-8">
        {/* Gaffer tape, at an angle somebody tore it at. */}
        <span
          aria-hidden
          className="tape right-6 top-4"
          style={{ "--tape-rot": "-5deg" } as React.CSSProperties}
        />

        <p className="kicker">{collection.tagline}</p>
        <h3 className="display misprint mt-3 text-4xl text-fg sm:text-5xl">
          {collection.name}
        </h3>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
          {collection.description}
        </p>

        <div className="mt-7 flex items-end justify-between gap-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
            {line}
          </p>
          <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-fg">
            See the rail
            <span
              aria-hidden
              className="transition-transform group-hover:translate-x-1"
            >
              &rarr;
            </span>
          </span>
        </div>

        {/* The pegs. Shirts hung under the banner - or bare hangers when the rail is
            empty, which reads as "not yet" rather than as "broken". */}
        <div className="mt-8 flex items-start gap-4 border-t border-line pt-6">
          {products.length
            ? products.slice(0, 3).map((p, i) => (
                <div
                  key={p.id}
                  className="flex flex-col items-center"
                  style={
                    { transform: `rotate(${[-2, 1.2, -0.8][i]}deg)` } as React.CSSProperties
                  }
                >
                  <Hook className="h-4 w-4" />
                  <div className="mt-0.5 h-[2px] w-14 bg-line-strong" />
                  <div className="mt-[-1px] h-16 w-16 overflow-hidden rounded-brand border border-line bg-surface/40">
                    {p.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-contain"
                      />
                    ) : null}
                  </div>
                </div>
              ))
            : [0, 1, 2].map((i) => <EmptyHanger key={i} className="opacity-40" />)}
        </div>
      </div>
    </Link>
  );
}

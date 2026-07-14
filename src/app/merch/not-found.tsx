import Link from "next/link";
import { activeCollections } from "@/lib/merch/collections";
import { collectionPath } from "@/lib/merch/urls";
import { EmptyHanger, RailBar, Stamp } from "@/components/shop/furniture";

// The shop's own 404, in the shop's own chrome.
//
// This is why the merch host rewrites an unknown path to /merch/<junk> rather than
// bouncing it to the main site the way the portal and survey hosts do: somebody who
// mistyped a collection name was trying to buy something, and the useful answer is the
// list of rails - not RNL's marketing homepage, on a different domain, with no
// explanation of what happened to the shop.

export default function ShopNotFound() {
  const collections = activeCollections();

  return (
    <div className="shell py-24">
      <p className="kicker">404</p>
      <h1 className="display misprint mt-5 text-5xl sm:text-6xl">
        No such rail
      </h1>
      <p className="mt-6 max-w-lg text-muted">
        That rail or item doesn&apos;t exist - it may have been renamed, or taken off
        sale. Here is everything we do have.
      </p>

      <div className="mt-12">
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
            <Stamp className="text-paper-ink">Empty</Stamp>
          </div>
        </div>
      </div>

      <div className="mt-14 flex flex-wrap gap-3">
        {collections.map((c) => (
          <Link key={c.slug} href={collectionPath(c.slug)} className="btn btn-ghost">
            {c.name}
          </Link>
        ))}
        <Link href="/" className="btn btn-accent">
          All merch
        </Link>
      </div>
    </div>
  );
}

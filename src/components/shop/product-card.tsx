import Link from "next/link";
import type { MerchProduct } from "@prisma/client";
import { productPath } from "@/lib/merch/urls";
import { priceLabel } from "@/lib/merch/price";
import { hangOffset, tagRotation } from "@/lib/merch/hang";
import { Hook, Stamp, SwingTag } from "./furniture";
import { cn } from "@/lib/utils";

// A shirt on a hanger. The atom of the shop, and a SERVER component - it must stay
// one, because <Rail> is a client component and takes these as `children`; the moment
// a card imports from a client boundary it gets bundled to the browser, and a rail of
// them takes the whole product list with it.
//
// It is not a card. It does not lift on hover - `.card-hover` translates -3px, and
// things that hang do not levitate. It swings, about its hook, and it settles. That is
// the one existing utility this design knowingly declines, and the reason is the whole
// direction.
//
// ---- What it does when the data is thin -----------------------------------
//
// This is the part that matters, because in production the data IS thin: plenty of
// products have no Roblox render yet. A design that only looks good with a full row is
// a design that looks broken on the day it ships. So a missing render turns into a
// DIFFERENT OBJECT rather than a hole: a STENCIL - the name, ghosted, on a blank panel,
// stamped AWAITING ARTWORK. A shirt whose print has not come back from the press.
//
// It is not "the sad version". It is a thing you would actually find on a merch table
// at the back of a venue.
//
// ---- The fallback that used to be here ------------------------------------
//
// A card with no Roblox render but a template on file used to draw the TEMPLATE: the
// raw 585x559 flat, as the card art, on the collection page, in the rail, on the
// homepage. It was the most exposed copy of the artwork on the whole site - a grid of
// stealable shirts, no click required - and it is gone.
//
// A card cannot show a mannequin (three.js in a rail of twelve is not a trade anybody
// would make), and it must never show the flat, so a product with no render is a
// stencil now even when its template is on file. If that ever looks too bare, the fix
// is to get a Roblox render for it - not to put the artwork back.

export function ProductCard({
  product,
  collection,
  showCollection,
  origin,
}: {
  product: MerchProduct;
  collection: string;
  /** On the index rail, where shirts from different collections hang together. */
  showCollection?: string;
  /**
   * The merch host, when this card is being rendered somewhere ELSE - the main site's
   * homepage, for instance.
   *
   * It matters, and it is not cosmetic: a product's path (/sleeptoken/pentagram-tee) is
   * a public URL **on merch.ronation.live**. That path does not exist on ronation.live -
   * the middleware only hands over /merch and /shop - so a relative link from the
   * homepage would 404. Pass merchOrigin() and it becomes an absolute cross-host link,
   * and the element below becomes a plain <a> rather than a next/link, because a
   * client-side route transition to another origin is not a thing.
   */
  origin?: string;
}) {
  const { hang, rot } = hangOffset(product.slug);
  const price = priceLabel(product);
  const offSale = !product.forSale;
  const path = productPath(collection, product.slug);
  const label = `${product.name}. ${price}.${product.limited ? " Limited." : ""}`;

  // The image, and which of the two objects this card is. Roblox's render, or nothing -
  // never the template. See the note above.
  const art = product.thumbnailUrl
    ? { kind: "render" as const, src: product.thumbnailUrl }
    : { kind: "none" as const, src: null };

  // Everything inside the link. Lifted out because the link itself is either a next/link
  // (inside the shop) or a plain <a> (cross-host, from the main site) - and duplicating
  // ninety lines of markup to switch one element is how the two copies drift apart.
  const body = (
    <div
      className="hanger-body"
      style={{ "--rest-rot": `${rot}deg` } as React.CSSProperties}
    >
          {/* The hook, over the bar. */}
          <div className="flex justify-center">
            <Hook className="transition-colors duration-200 group-hover:text-accent" />
          </div>

          {/* The shoulder bar the garment hangs off. */}
          <div className="mx-auto h-[3px] w-[70%] rounded-brand bg-line-strong transition-colors duration-200 group-hover:bg-accent/60" />

          {/* The garment. A bordered panel, never a filled card - see the note at the
              top of the merch-table block in globals.css. */}
          <div
            className={cn(
              "relative mt-[-1px] overflow-hidden border border-line bg-surface/40 transition-colors duration-200 group-hover:border-accent/55",
              "rounded-brand",
            )}
          >
            <div className="relative aspect-[4/5]">
              {art.src ? (
                // Not next/image: tr.rbxcdn.com URLs rotate, and an unconfigured
                // remote host in next.config THROWS rather than degrading. A product
                // card is not worth a crash. (The same comment is in the repo already
                // and it is right.)
                //
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={art.src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className={cn(
                    "h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.04]",
                    // NEVER saturate-0 on an off-sale item: it drains the stamp too,
                    // and a grey stamp on a grey card is a stamp you have to hunt for.
                    offSale && "opacity-60",
                  )}
                />
              ) : (
                // The stencil. The name is the subject when there is no artwork.
                <div className="grid h-full place-items-center px-4">
                  <p className="display text-center text-2xl leading-none text-fg/[0.14]">
                    {product.name}
                  </p>
                </div>
              )}

              {/* Overprints. Both aria-hidden; both duplicated in the link's name. */}
              {offSale ? (
                <span className="absolute inset-0 grid place-items-center">
                  <Stamp className="text-fg">Off sale</Stamp>
                </span>
              ) : null}
              {art.kind === "none" && !offSale ? (
                <span className="absolute inset-x-0 bottom-4 grid place-items-center">
                  <Stamp className="text-fg !text-[11px]">Awaiting artwork</Stamp>
                </span>
              ) : null}
            </div>

            {product.limited ? (
              <span className="pill ticket-foil absolute right-2 top-2 overflow-hidden !text-[9px] !text-accent">
                Ltd
              </span>
            ) : null}
          </div>

          {/* The tag, pinned on by hand. */}
          <div className="relative mt-4 flex items-start justify-between gap-3 pl-1">
            <div className="min-w-0">
              {showCollection ? (
                <p className="kicker !text-[9px] !tracking-[0.16em]">
                  {showCollection}
                </p>
              ) : null}
              <p className="display mt-1 truncate text-[15px] leading-none text-fg transition-colors duration-200 group-hover:text-accent">
                {product.name}
              </p>
            </div>

          <SwingTag
            label={price}
            muted={offSale}
            rot={tagRotation(product.slug)}
            className="shrink-0"
          />
        </div>
      </div>
  );

  return (
    <li className="hanger" style={{ "--hang": `${hang}px` } as React.CSSProperties}>
      {origin ? (
        // Cross-host. A next/link cannot route to another origin, so this is a real
        // anchor and a real navigation - which is what it is.
        <a
          href={`${origin}${path}`}
          aria-label={label}
          className="hanger-link group"
        >
          {body}
        </a>
      ) : (
        <Link
          href={path}
          // The accessible name carries everything the stamps say visually. No meaning
          // in this card is ever colour-only or motion-only.
          aria-label={label}
          className="hanger-link group"
        >
          {body}
        </Link>
      )}
    </li>
  );
}

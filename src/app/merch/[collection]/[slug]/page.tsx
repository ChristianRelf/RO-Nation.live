import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { collectionBySlug } from "@/lib/merch/collections";
import { collectionPath, robloxCatalogUrl } from "@/lib/merch/urls";
import { priceLabel } from "@/lib/merch/price";
import { tagRotation } from "@/lib/merch/hang";
import { CollectionDisclaimer } from "@/components/shop/shop-footer";
import { ProductStage } from "@/components/shop/product-stage";
import { PlateFlat } from "@/components/shop/plate-flat";
import { Docket } from "@/components/shop/docket";
import { Rail } from "@/components/shop/rail";
import { ProductCard } from "@/components/shop/product-card";
import { SwingTag } from "@/components/shop/furniture";

/**
 * One shirt, on the table.
 *
 * The whole page does two things: show you the garment on a body, and get you to
 * Roblox. There is no cart and there must never be one - RNL cannot charge Robux from
 * a website, so a page dressed as a checkout is a page that would take somebody's
 * money and not honour it. The primary action is a link OUT, and the merch-table
 * framing is what makes that read as the point rather than as a limitation: you handle
 * the goods here, you pay at the counter.
 */

const KIND_LABEL: Record<string, string> = {
  SHIRT: "Classic shirt",
  TSHIRT: "Classic t-shirt",
  PANTS: "Classic pants",
};

async function findProduct(collectionSlug: string, slug: string) {
  const collection = collectionBySlug(collectionSlug);
  if (!collection) return null;

  const product = await prisma.merchProduct.findFirst({
    // Scoped to the collection AND to `visible`, not just to the slug. Slugs are
    // globally unique, so a lookup on slug alone would happily serve a hidden product
    // - or serve a real one from under a URL naming the wrong rail, which is a second
    // canonical address for the same page.
    where: { slug, collection: collection.slug, visible: true },
  });
  if (!product) return null;

  return { collection, product };
}

export async function generateMetadata({
  params,
}: {
  params: { collection: string; slug: string };
}): Promise<Metadata> {
  const found = await findProduct(params.collection, params.slug);
  if (!found) return {};

  const { product } = found;
  return {
    title: product.name,
    description:
      product.description ?? `${product.name} - Roblox merch from RO. Nation LIVE.`,
    openGraph: {
      title: product.name,
      description: product.description ?? undefined,
      images: product.thumbnailUrl ? [product.thumbnailUrl] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: { collection: string; slug: string };
}) {
  const found = await findProduct(params.collection, params.slug);
  if (!found) notFound();

  const { collection, product } = found;
  const buyable = product.forSale;
  const price = priceLabel(product);

  // The product page used to have no way onward at all except the back link. This is
  // the moment you would glance sideways at the rest of the stall.
  const siblings = await prisma.merchProduct.findMany({
    where: {
      collection: collection.slug,
      visible: true,
      NOT: { id: product.id },
    },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    take: 10,
  });

  return (
    <>
      <div className="shell py-14">
        <Link
          href={collectionPath(collection.slug)}
          className="link-underline text-[11px] font-bold uppercase tracking-[0.14em] text-muted transition-colors hover:text-fg"
        >
          &larr; {collection.name}
        </Link>

        <div className="mt-8 grid gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          {/* ---- THE TABLE ---- */}
          <ProductStage
            kind={product.kind}
            textureUrl={product.textureUrl}
            thumbnailUrl={product.thumbnailUrl}
            name={product.name}
          />

          {/* ---- THE COUNTER ---- */}
          <div className="relative lg:pt-4">
            <p className="kicker">{collection.name}</p>

            <div className="mt-4 flex items-start justify-between gap-6">
              <h1 className="display misprint text-4xl leading-[0.9] sm:text-5xl">
                {product.name}
              </h1>
              <SwingTag
                label={price}
                muted={!buyable}
                rot={tagRotation(product.slug)}
                className="mt-1 shrink-0"
              />
            </div>

            {/* Roblox's own description is usually a bare tag list, or nothing at all.
                When it is nothing, the docket below carries the column - which is why
                this page can never look half-built. */}
            {product.description ? (
              <p className="mt-7 whitespace-pre-line leading-relaxed text-muted">
                {product.description}
              </p>
            ) : null}

            <Docket
              className="mt-8"
              rows={[
                { label: "Cut", value: KIND_LABEL[product.kind] ?? product.kind },
                { label: "Catalog", value: product.assetId },
                {
                  label: "Sold",
                  value: product.sales > 0
                    ? product.sales.toLocaleString("en-GB")
                    : "-",
                },
                {
                  label: "Print",
                  value: product.textureUrl
                    ? "Template on file"
                    : "Roblox render only",
                },
                {
                  label: "Status",
                  value: [
                    buyable ? "On sale" : "Off sale",
                    product.limited ? "Limited" : null,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                  loud: buyable,
                },
              ]}
            />

            {buyable ? (
              <a
                href={robloxCatalogUrl(product.assetId, product.name)}
                target="_blank"
                rel="noreferrer"
                // btn-accent, not btn-primary. There is no .btn-primary in globals.css
                // and there never was - this button spent its whole life rendering with
                // padding, uppercase text, and no background or border at all.
                className="btn btn-accent mt-10 inline-flex"
              >
                Buy on Roblox &#8599;
              </a>
            ) : (
              // Not a dead disabled button. An off-sale item still has a Roblox page
              // worth seeing, and a grey unclickable rectangle teaches people the site
              // is broken.
              <div className="mt-10">
                <p className="text-sm text-muted">
                  This one isn&apos;t on sale right now.
                </p>
                <a
                  href={robloxCatalogUrl(product.assetId, product.name)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost mt-4 inline-flex"
                >
                  View on Roblox &#8599;
                </a>
              </div>
            )}

            <p className="mt-6 text-xs leading-relaxed text-faint">
              Sold on Roblox. Payment and ownership are handled there - RO. Nation LIVE
              never takes payment for merch.
            </p>
          </div>
        </div>

        {/* ---- THE PATTERN PIECE ---- */}
        {product.textureUrl ? (
          <PlateFlat src={product.textureUrl} name={product.name} />
        ) : null}
      </div>

      {/* ---- THE REST OF THE STALL ---- */}
      {siblings.length > 1 ? (
        <Rail
          label="Also on this rail"
          count={siblings.length}
          className="pb-6 pt-4"
        >
          {siblings.map((p) => (
            <ProductCard key={p.id} product={p} collection={collection.slug} />
          ))}
        </Rail>
      ) : null}

      {collection.disclaimer ? (
        <div className="shell pb-6">
          <CollectionDisclaimer text={collection.disclaimer} />
        </div>
      ) : null}
    </>
  );
}

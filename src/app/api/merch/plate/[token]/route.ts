import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { plateTile } from "@/lib/merch/plate";
import { openTile, tileBelongs } from "@/lib/merch/tiles";

// Node, not edge: this reads the private volume and runs sharp.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One face of one cube, shredded. The only door the clothing templates have.
//
// Everything it refuses, it refuses with a 404 rather than a 403. There is nothing to
// be gained by confirming that a token was well-formed but pointed at a hidden
// product, or that a product exists but has no template on file - a prober learns the
// shape of the shop from the difference between "no" and "not allowed".

/**
 * A browser, on our own page - not curl, not an address bar, not somebody else's site.
 *
 * Sec-Fetch-Site is set by the browser itself and cannot be spoofed from script, so
 * `same-origin` is a real statement about where the request came from. It has been in
 * every current engine for years, but not forever, so an absent header falls back to
 * the Referer's host rather than locking out an old Safari. Both absent - which is
 * what a scripted fetch actually looks like - is a no.
 *
 * This is a speed bump, and an honest one: anybody who sets two headers walks through
 * it. It is here to stop the hotlink and the casual scrape, not the determined thief,
 * and the things that actually matter are one layer down - the template is not on a
 * public volume, the tokens are not enumerable, and what comes back is shredded.
 */
function fromOurPage(req: NextRequest): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "same-site";

  const referer = req.headers.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).host === req.headers.get("host");
  } catch {
    return false;
  }
}

const missing = () => new NextResponse("Not found", { status: 404 });

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  if (!fromOurPage(req)) return missing();

  const opened = openTile(params.token);
  if (!opened) return missing();

  // Re-checked against the database on every single request, never trusted from the
  // token. A token is permanent - it is a pure function of the product and the face -
  // so one minted while a shirt was on the shelf would otherwise keep working after it
  // was pulled from it. `visible` is the shop's own rule for what the public may see,
  // and it is the rule here too.
  const product = await prisma.merchProduct.findFirst({
    where: { id: opened.productId, visible: true },
    select: { kind: true, texturePath: true },
  });
  if (!product?.texturePath) return missing();

  // A tile of a garment that has no such face - the decal of a shirt, a sleeve of a
  // t-shirt. Cheap to check, and it keeps the cutter from being asked for rectangles
  // that make no sense for the file it is holding.
  if (!tileBelongs(opened.tileId, product.kind)) return missing();

  const png = await plateTile(product.texturePath, opened.tileId, params.token);
  if (!png) return missing();

  return new NextResponse(png, {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(png.byteLength),

      // A year, immutable. The token is deterministic and the bytes behind it never
      // change, so this is safe - and it is what keeps the second view of a shirt (and
      // every other shopper behind the same CDN) from costing eighteen decodes.
      "Cache-Control": "public, max-age=31536000, immutable",

      // Not a resource anybody else's page may embed, and not one a search engine may
      // index or cache a copy of. Both matter more here than they would for a
      // thumbnail: an indexed tile is a tile that outlives our ability to unpublish it.
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Robots-Tag": "noindex, noimageindex, noarchive",

      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

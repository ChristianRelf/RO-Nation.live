import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hasAnyScope } from "@/lib/portal-scope";
import { PRIVATE_UPLOAD_DIR, resolveInRoot } from "@/lib/uploads";

export const dynamic = "force-dynamic";
// Node, not edge: this reads the filesystem.
export const runtime = "nodejs";

// The gated file server.
//
// Everything under /uploads is handed out by Caddy straight off the volume,
// before Next ever sees the request - which is right for a logo and unacceptable
// for a brand guideline. So INTERNAL assets are written to a different root, on a
// volume Caddy does not mount, and served HERE: one request at a time, with the
// session re-read every time.
//
// A leaked /files/<id> link is worth nothing to a signed-out stranger. They get
// the same 404 as a made-up id - which is deliberate, and is why this returns 404
// rather than 403 for a caller who is simply not allowed: a 403 would confirm the
// id names a real file.

/**
 * RFC 6266. `filename` is user input and this is a header, so strip anything that
 * could end the quoted string or inject a second header, then send the real name
 * separately in the UTF-8 form for anything non-ASCII.
 */
function contentDisposition(filename: string, inline: boolean) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const utf8 = encodeURIComponent(filename);
  const kind = inline ? "inline" : "attachment";
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

const notFound = () => new NextResponse("Not found", { status: 404 });

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  // The session FIRST, before the row is even looked up. Anyone with a portal
  // door may read the docs, so this is the same question requireDocsReader() asks
  // - short-circuiting, because a PDF viewer will issue several of these and the
  // full walk would put a rank lookup in the path of every one.
  if (!(await hasAnyScope())) return notFound();

  const asset = await prisma.brandAsset.findFirst({
    // INTERNAL only. A PUBLIC asset is not served here - it has a real URL on the
    // Caddy volume, and serving it through the app as well would mean two ways to
    // reach one file, one of which nobody would remember to think about.
    where: { id: params.id, visibility: "INTERNAL" },
  });
  if (!asset) return notFound();

  const target = resolveInRoot(PRIVATE_UPLOAD_DIR, asset.storagePath);
  if (!target) return notFound();

  let size: number;
  try {
    const info = await stat(target);
    if (!info.isFile()) return notFound();
    size = info.size;
  } catch {
    // The row outlived its bytes. Nothing useful to say, and nothing worth
    // distinguishing from a bad id.
    return notFound();
  }

  // A real Node → Web stream conversion. The dev uploads handler casts a Node
  // stream straight to ReadableStream, which happens to work in Next's Node
  // runtime but is a lie to the type system; don't copy that bit.
  const body = Readable.toWeb(
    createReadStream(target),
  ) as ReadableStream<Uint8Array>;

  // Rendered in place for a PDF or an image; downloaded for anything else.
  //
  // "Rendered in place" no longer means FRAMED by this URL - the docs viewer fetches
  // these bytes and frames a blob (see components/pdf-embed.tsx), so this response can
  // keep the site-wide DENY and the strict sandbox and nothing has to be relaxed for a
  // PDF. `inline` still matters for anyone who opens the file directly.
  const inline =
    asset.mime === "application/pdf" || asset.mime.startsWith("image/");

  return new NextResponse(body, {
    headers: {
      // Sniffed from the bytes at upload - never a string a client supplied.
      "Content-Type": asset.mime,
      "Content-Length": String(size),
      "Content-Disposition": contentDisposition(asset.filename, inline),
      // The whole point of this route. `public, max-age=…, immutable` - which is
      // exactly what Caddy sends for /uploads, and exactly what you would reach
      // for by reflex - would let a shared cache or a CDN hold a gated PDF and
      // hand it to the next person who asked, session or no session.
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      Vary: "Cookie",
      // The same two defences Caddy applies to /uploads: an SVG navigated to
      // directly would otherwise execute on RNL's own origin.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

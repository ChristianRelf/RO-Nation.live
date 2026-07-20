import "server-only";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { PRIVATE_UPLOAD_DIR, resolveInRoot } from "@/lib/uploads";

// Handing out a file from the volume Caddy cannot see.
//
// There are two doors onto that volume now - brand assets (app/files/[id]) and
// survey attachments (app/files/survey/[id]) - and they ask completely different
// questions about who you are. What they must NOT differ on is the response: the
// cache headers below are the only thing standing between a gated file and a
// shared cache handing it to the next person who asks, and a second hand-written
// copy of them is a second chance to forget one.
//
// So the AUTHORISATION stays in each route, where it belongs, and everything after
// "yes, they may" lives here.

/**
 * RFC 6266. `filename` is user input and this is a header, so strip anything that
 * could end the quoted string or inject a second header, then send the real name
 * separately in the UTF-8 form for anything non-ASCII.
 */
export function contentDisposition(filename: string, inline: boolean) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const utf8 = encodeURIComponent(filename);
  const kind = inline ? "inline" : "attachment";
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

/** The same 404 for a bad id, a missing file and a caller who may not have it. */
export const fileNotFound = () => new NextResponse("Not found", { status: 404 });

/**
 * Stream a stored file to an ALREADY-AUTHORISED caller.
 *
 * Callers must have checked the session before calling this - it takes a database
 * row's worth of facts and does no access control of its own.
 */
export async function streamPrivateFile(asset: {
  storagePath: string;
  mime: string;
  filename: string;
}) {
  const target = resolveInRoot(PRIVATE_UPLOAD_DIR, asset.storagePath);
  if (!target) return fileNotFound();

  let size: number;
  try {
    const info = await stat(target);
    if (!info.isFile()) return fileNotFound();
    size = info.size;
  } catch {
    // The row outlived its bytes. Nothing useful to say, and nothing worth
    // distinguishing from a bad id.
    return fileNotFound();
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
      // The whole point of these routes. `public, max-age=…, immutable` - which is
      // exactly what Caddy sends for /uploads, and exactly what you would reach
      // for by reflex - would let a shared cache or a CDN hold a gated file and
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

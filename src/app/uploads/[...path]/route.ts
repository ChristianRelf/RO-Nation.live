import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { UPLOAD_DIR } from "@/lib/uploads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Serves /uploads/* IN DEVELOPMENT ONLY.
//
// In production Caddy matches /uploads/* off the volume before the request ever
// reaches Next (see the Caddyfile), so this handler is dead code there — it
// exists because `npm run dev` has no Caddy in front of it, and without it every
// image you upload locally 404s.
//
// It deliberately mirrors the headers Caddy sends, so what you see in dev is what
// production does. The important pair:
//
//   nosniff   the browser must honour the Content-Type below rather than
//             sniffing the bytes and deciding an image is really HTML.
//   sandbox   an SVG navigated to directly executes its scripts in the origin it
//             is served from — which is RNL's. `sandbox` drops it into an opaque
//             origin, so a hostile SVG cannot touch a cookie or call an API.

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  // The path comes off the URL, so it is user input. Resolve it and then check
  // the result is still inside UPLOAD_DIR: "..%2F..%2F.env" is a real request
  // somebody will make, and `path.join` alone would happily walk out of the
  // directory. Comparing after resolution is what actually closes it.
  const target = path.resolve(UPLOAD_DIR, ...params.path);
  const root = path.resolve(UPLOAD_DIR);
  if (target !== root && !target.startsWith(root + path.sep)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = path.extname(target).toLowerCase();
  const type = TYPES[ext];
  if (!type) return new NextResponse("Not found", { status: 404 });

  let size: number;
  try {
    const info = await stat(target);
    if (!info.isFile()) return new NextResponse("Not found", { status: 404 });
    size = info.size;
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const stream = createReadStream(target);
  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(size),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

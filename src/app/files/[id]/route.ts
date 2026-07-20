import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hasAnyScope } from "@/lib/portal-scope";
import { fileNotFound, streamPrivateFile } from "@/lib/private-file";

export const dynamic = "force-dynamic";
// Node, not edge: this reads the filesystem.
export const runtime = "nodejs";

// The gated file server, for brand assets.
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
//
// The streaming and the headers live in lib/private-file.ts, shared with the
// survey-attachment door. What stays here is the only thing the two doors do not
// agree on: who is allowed through.

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  // The session FIRST, before the row is even looked up. Anyone with a portal
  // door may read the docs, so this is the same question requireDocsReader() asks
  // - short-circuiting, because a PDF viewer will issue several of these and the
  // full walk would put a rank lookup in the path of every one.
  if (!(await hasAnyScope())) return fileNotFound();

  const asset = await prisma.brandAsset.findFirst({
    // INTERNAL only. A PUBLIC asset is not served here - it has a real URL on the
    // Caddy volume, and serving it through the app as well would mean two ways to
    // reach one file, one of which nobody would remember to think about.
    where: { id: params.id, visibility: "INTERNAL" },
  });
  if (!asset) return fileNotFound();

  return streamPrivateFile(asset);
}

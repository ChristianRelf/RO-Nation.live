import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { readFile } from "fs/promises";
import { getCompanyUser } from "@/lib/company";
import { PRIVATE_UPLOAD_DIR, resolveInRoot } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The one place a whole template is still drawn - and only for the people who own it.
//
// The admin has to be able to see that they uploaded the right file. A template is not
// self-describing: the difference between this season's shirt and last season's is the
// artwork, and a form that says "template on file ✓" and nothing else is a form that
// will eventually have the wrong shirt on file and no way to notice.
//
// So it is served, under three conditions that make it a different object from the
// public flat that used to exist:
//
//   1. requireCompanyUser, on every request. Not a signed URL, not an unguessable path
//      - a live session check against the rank ladder, re-run every single time.
//   2. Downscaled and WATERMARKED. Staff already have the original; they uploaded it.
//      What they need here is to RECOGNISE the artwork, and a defaced half-size copy
//      does that just as well. So even if a preview leaks out of an admin's tab, out of
//      a screenshot in a group chat, or out of a stolen session, what leaks is not a
//      usable shirt.
//   3. no-store. It never lands in a shared cache, and it never lands on disk.
//
// The private volume is still the real defence. This is the crack of the door, and it
// is deliberately as narrow as it can be while still doing its job.

/** Half size. Recognisable at a glance; useless as a 64px/stud print. */
const PREVIEW_SCALE = 0.5;

function watermark(width: number, height: number): Buffer {
  // Repeated across the sheet rather than stamped once in the middle - a single stamp
  // is a single crop away from being gone.
  const rows = [];
  for (let y = 40; y < height + 80; y += 90) {
    rows.push(
      `<text x="-40" y="${y}" font-family="monospace" font-size="18" font-weight="bold"
             fill="#ff2d55" fill-opacity="0.42" transform="rotate(-24 0 ${y})"
             textLength="${width + 260}" lengthAdjust="spacing">
         RO. NATION LIVE · STAFF PREVIEW · NOT FOR DISTRIBUTION
       </text>`,
    );
  }

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
       ${rows.join("")}
     </svg>`,
  );
}

export async function GET(req: NextRequest) {
  const user = await getCompanyUser();
  if (!user) return new NextResponse("Not found", { status: 404 });

  // The path is the admin's own form value, echoed back - so it is user input, and it
  // is resolved back inside the private root before anything opens it. Without this,
  // "../../etc/passwd" is a staff member away from being served.
  const path = req.nextUrl.searchParams.get("path");
  if (!path) return new NextResponse("Not found", { status: 404 });

  const file = resolveInRoot(PRIVATE_UPLOAD_DIR, path);
  if (!file) return new NextResponse("Not found", { status: 404 });

  let png: Buffer;
  try {
    const bytes = await readFile(file);
    const image = sharp(bytes);
    const meta = await image.metadata();

    const width = Math.max(1, Math.round((meta.width ?? 585) * PREVIEW_SCALE));
    const height = Math.max(1, Math.round((meta.height ?? 559) * PREVIEW_SCALE));

    png = await image
      .resize(width, height)
      .composite([{ input: watermark(width, height), blend: "over" }])
      .png()
      .toBuffer();
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(png, {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(png.byteLength),
      // Never cached, anywhere, by anyone. The session that was checked above is valid
      // for this request and this request only.
      "Cache-Control": "private, no-store, max-age=0",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Robots-Tag": "noindex, noimageindex, noarchive",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

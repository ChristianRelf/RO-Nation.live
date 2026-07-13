import "server-only";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

// Where uploaded images live, and how one is accepted.
//
// The bytes go to a directory on disk (a Docker volume in production, ./uploads
// in dev) and are served straight off it by Caddy — they never pass back through
// Next. The database only records what was uploaded and by whom (MediaAsset).
//
// Everything below is about not trusting the file. A browser can claim any
// filename, any content type and any size; none of that is evidence.

/**
 * The upload root. A volume in the container, a gitignored folder in dev.
 *
 * The path is absolute in production because the container's working directory
 * is not somewhere you want to be writing user files relative to.
 */
export const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

/** The public prefix. Caddy serves this straight off the volume — see the Caddyfile. */
export const UPLOAD_URL_PREFIX = "/uploads";

/** 5 MB. Big enough for show artwork, small enough that the disk is not a target. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * The image types we accept, keyed by the bytes a real file of that type starts
 * with. The browser's `file.type` and the file's extension are both just claims —
 * a .png that begins "MZ" is a Windows executable, and storing it under an image
 * name is how you end up hosting somebody else's malware.
 *
 * So the type is decided HERE, from the content, and the extension we save under
 * is derived from what we found — not from what we were told.
 */
type Sniffed = { mime: string; ext: string };

function sniff(bytes: Uint8Array): Sniffed | null {
  const starts = (...sig: number[]) =>
    sig.every((b, i) => bytes[i] === b);

  // JPEG — FF D8 FF
  if (starts(0xff, 0xd8, 0xff)) return { mime: "image/jpeg", ext: "jpg" };

  // PNG — 89 50 4E 47 0D 0A 1A 0A
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return { mime: "image/png", ext: "png" };
  }

  // GIF — "GIF87a" or "GIF89a"
  if (starts(0x47, 0x49, 0x46, 0x38)) return { mime: "image/gif", ext: "gif" };

  // WebP — "RIFF" .... "WEBP" (the size field sits between the two)
  if (
    starts(0x52, 0x49, 0x46, 0x46) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mime: "image/webp", ext: "webp" };
  }

  // SVG is text, so it has no magic number — it is sniffed by shape instead.
  //
  // It is the one accepted type that can carry script. An <img src> never executes
  // it, but a browser NAVIGATED to the file would, and it would run on RNL's own
  // origin. That is why Caddy serves this whole directory with `sandbox` and a
  // null-source CSP (see the Caddyfile) — the header is the actual defence here,
  // not this check, which only decides what to call the file.
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.subarray(0, 256))
    .trimStart()
    .toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) {
    return { mime: "image/svg+xml", ext: "svg" };
  }

  return null;
}

export type UploadResult =
  | { ok: true; url: string; mime: string; size: number; filename: string }
  | { ok: false; error: "empty" | "too-large" | "unsupported" };

/**
 * Validate `file` and write it into `scope`'s directory.
 *
 * `scope` is a partner slug or "rnl". It is the ONLY thing that decides the
 * directory, and callers pass a slug they have already been authorised for — so
 * one partner physically cannot write into another's folder.
 *
 * The stored name is a fresh UUID. The uploader's filename is kept in the
 * database for display and is never used to build a path: a name like
 * "../../.env" is a directory-traversal attempt, and the safest way to not have
 * that bug is to never join user input onto a path at all.
 */
export async function saveUpload(
  file: File,
  scope: string,
): Promise<UploadResult> {
  if (file.size === 0) return { ok: false, error: "empty" };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "too-large" };

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Re-checked against the bytes actually received, not the size the browser
  // declared in the multipart headers.
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "too-large" };
  }

  const type = sniff(bytes);
  if (!type) return { ok: false, error: "unsupported" };

  const name = `${randomUUID()}.${type.ext}`;
  const dir = path.join(UPLOAD_DIR, scope);

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);

  return {
    ok: true,
    url: `${UPLOAD_URL_PREFIX}/${scope}/${name}`,
    mime: type.mime,
    size: bytes.byteLength,
    // Display only. Trimmed hard, because it goes on to be rendered.
    filename: file.name.slice(0, 200) || name,
  };
}

/** The directory a scope's files live in. "rnl" for RNL's own. */
export const RNL_SCOPE = "rnl";

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

/**
 * Where files that must NOT be public live: the brand guideline PDFs, unreleased
 * artwork.
 *
 * A separate root, on a separate Docker volume, and the entire security property
 * is one line of docker-compose.yml — that volume is mounted into `web` and is
 * NOT mounted into `caddy`.
 *
 * It has to be this way round rather than a rule in the Caddyfile. Caddy serves
 * /uploads/* straight off its volume, before the request has been anywhere near
 * this application, so nothing under that prefix can ever consult a session — a
 * "private" subfolder of it would be one typo away from being world-readable, and
 * the typo would be silent. Here, Caddy does not have the directory in its
 * filesystem at all: no Caddyfile edit can expose it, and no traversal out of
 * /srv/uploads can reach it.
 *
 * The only reader is app/files/[id]/route.ts, which checks a session first, on
 * every single request.
 */
export const PRIVATE_UPLOAD_DIR =
  process.env.PRIVATE_UPLOAD_DIR || path.join(process.cwd(), "private-uploads");

/**
 * The outer wall: nothing larger is read into memory at all.
 *
 * It was 5 MB, which was right when the only thing anybody uploaded was show
 * artwork. A brand guideline PDF is routinely 15–20 MB, so the wall has to move —
 * but it moves for PDFs, not for everything. See MAX_BYTES below: the real cap is
 * per type, applied once the bytes have been sniffed and we know what they
 * actually are. Raising this number alone would quietly permit a 25 MB PNG, which
 * is not a poster — it is somebody filling the disk.
 */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** The cap that actually applies, by what the bytes turned out to be. */
const MAX_BYTES: Record<string, number> = {
  "application/pdf": 25 * 1024 * 1024,
};

/** Images. Unchanged, and deliberately so. */
const MAX_BYTES_DEFAULT = 5 * 1024 * 1024;

const limitFor = (mime: string) => MAX_BYTES[mime] ?? MAX_BYTES_DEFAULT;

/**
 * What a given door will accept — because "which types are allowed" is a property
 * of the door, not of the disk.
 *
 * A cover image, a show thumbnail, a partner's artwork: all of these end up in an
 * <img src>, so a PDF there is not a security problem but it is a broken picture.
 * Only the brand-asset door has any use for one, so only the brand-asset door
 * takes ASSET. Everything else keeps the guarantee it has always had: what comes
 * back from an upload is an image.
 */
export const IMAGE_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

export const ASSET_TYPES: readonly string[] = [
  ...IMAGE_TYPES,
  "application/pdf",
];

/**
 * The types we accept, keyed by the bytes a real file of that type starts with.
 * The browser's `file.type` and the file's extension are both just claims — a
 * .png that begins "MZ" is a Windows executable, and storing it under an image
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

  // PDF — "%PDF-" (25 50 44 46 2D)
  //
  // The one non-image type accepted, and only because a brand guideline IS a PDF.
  // It carries nothing a browser will run from an <img>, and like everything else
  // on this volume it is served with nosniff and a sandbox CSP either way.
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) {
    return { mime: "application/pdf", ext: "pdf" };
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

type UploadFailure = {
  ok: false;
  error: "empty" | "too-large" | "unsupported";
  /** The cap that was actually broken, so the message can name the right number. */
  limit?: number;
};

/** What both doors have in common once the bytes are on disk. */
type StoredFile = {
  ok: true;
  /** "<scope>/<uuid>.<ext>" — relative to whichever root it was written to. */
  storagePath: string;
  mime: string;
  size: number;
  filename: string;
};

/** The public door also hands back the URL Caddy will serve it from. */
export type UploadResult = (StoredFile & { url: string }) | UploadFailure;

/** The private door does not, because there isn't one. That is the whole point. */
export type PrivateUploadResult = StoredFile | UploadFailure;

/**
 * Validate `file` and write it into `scope`'s directory under `root`.
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
async function store(
  file: File,
  scope: string,
  root: string,
  accept: readonly string[],
): Promise<StoredFile | UploadFailure> {
  if (file.size === 0) return { ok: false, error: "empty" };

  // The outer wall first, on the declared size, so an oversized body is refused
  // before it is read into memory.
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "too-large", limit: MAX_UPLOAD_BYTES };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Re-checked against the bytes actually received, not the size the browser
  // declared in the multipart headers.
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "too-large", limit: MAX_UPLOAD_BYTES };
  }

  const type = sniff(bytes);
  // Unrecognised, or recognised but not something THIS door takes — a PDF posted
  // at the cover-image field is refused here, not stored and then rendered as a
  // broken picture.
  if (!type || !accept.includes(type.mime)) {
    return { ok: false, error: "unsupported" };
  }

  // And now the cap that actually applies, decided by what the bytes turned out
  // to BE — not by what the outer wall let through. A 25 MB PNG dies here.
  const limit = limitFor(type.mime);
  if (bytes.byteLength > limit) {
    return { ok: false, error: "too-large", limit };
  }

  const name = `${randomUUID()}.${type.ext}`;
  const dir = path.join(root, scope);

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);

  return {
    ok: true,
    storagePath: `${scope}/${name}`,
    mime: type.mime,
    size: bytes.byteLength,
    // Display only. Trimmed hard, because it goes on to be rendered.
    filename: file.name.slice(0, 200) || name,
  };
}

/**
 * The public door: onto the volume Caddy serves. Images by default — see
 * IMAGE_TYPES for why the type set belongs to the door and not to the disk.
 */
export async function saveUpload(
  file: File,
  scope: string,
  opts: { accept?: readonly string[] } = {},
): Promise<UploadResult> {
  const saved = await store(file, scope, UPLOAD_DIR, opts.accept ?? IMAGE_TYPES);
  if (!saved.ok) return saved;
  return { ...saved, url: `${UPLOAD_URL_PREFIX}/${saved.storagePath}` };
}

/**
 * The private door: onto the volume Caddy cannot see. Returns no URL, because
 * nothing serves these but app/files/[id], which addresses them by database id
 * and checks a session first.
 */
export async function savePrivateUpload(
  file: File,
  scope: string,
  opts: { accept?: readonly string[] } = {},
): Promise<PrivateUploadResult> {
  return store(file, scope, PRIVATE_UPLOAD_DIR, opts.accept ?? IMAGE_TYPES);
}

/** The directory a scope's files live in. "rnl" for RNL's own. */
export const RNL_SCOPE = "rnl";

/**
 * Resolve a stored path against its root, refusing anything that escapes.
 *
 * `storagePath` is ours — a UUID this module generated — and never the client's.
 * But it is a database column, and a column is one bad migration or one careless
 * seed script away from holding "../../.env". The check costs nothing and it is
 * the second lock on the door that app/files/[id] is the first.
 */
export function resolveInRoot(root: string, storagePath: string): string | null {
  const base = path.resolve(root);
  const target = path.resolve(base, storagePath);
  if (target !== base && !target.startsWith(base + path.sep)) return null;
  return target;
}

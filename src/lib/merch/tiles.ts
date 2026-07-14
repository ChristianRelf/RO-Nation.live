import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac } from "crypto";
import type { MerchKind } from "@prisma/client";
import { LEFT_LIMB, RIGHT_LIMB, TORSO, type Net, type Rect } from "./template";
import { FACE_ORDER } from "./uv";

// The garment, cut into pieces, each piece behind a sealed address.
//
// ---- Why the flat is not served ------------------------------------------
//
// A classic Roblox shirt IS its 585x559 template. Hand somebody that PNG and you have
// handed them the shirt: they upload it to their own group and sell it. It is the one
// asset on this site whose theft is a copy-paste, and until now the product page put
// it in an <img> at full resolution, on a public path, with a one-year immutable
// cache. Right-click, Save As, done.
//
// So the template no longer lives anywhere a browser can ask for it. It goes to
// PRIVATE_UPLOAD_DIR - the volume that is deliberately not mounted into Caddy (see
// lib/uploads.ts and the docker-compose comment that says DO NOT ADD IT) - and the
// only thing that ever leaves the server is one face of one cube at a time, shredded,
// through the route in app/api/merch/plate.
//
// ---- What a page hands the browser ---------------------------------------
//
// Eighteen tokens. Each is an AES-256-GCM sealed `<productId>|<tileId>` pair: opaque,
// unguessable without the key, and impossible to enumerate - you cannot walk from one
// product's tiles to another's, and you cannot ask for a tile of a product that is not
// on sale. They are also DETERMINISTIC, which is not a detail: the same tile seals to
// the same token every time, so the response can carry an immutable cache header and
// the second view of a shirt costs no requests at all.
//
// What a thief gets from the network tab is eighteen unlabelled squares of confetti,
// with nothing in the URL to say which is which, no dimensions that give it away
// (every sleeve face is the same 64x128), and no way to tell a torso front from a
// torso back without reassembling them by eye.

/** The three cube nets a garment is made of. Keys are stable - they go in tokens. */
const PARTS: Record<string, Net> = {
  t: TORSO,
  r: RIGHT_LIMB,
  l: LEFT_LIMB,
};

/**
 * A t-shirt is not a shirt: assetTypeId 2 is a plain decal on the torso's front face,
 * with no template and no net. It gets one tile rather than eighteen.
 *
 * It is normalised to a square on the way out (see plate.ts) for two reasons. The
 * shuffle needs a grid of whole 16px cells, and an arbitrary user PNG will not give
 * one - but also, it means the decal a thief pulls is not the artist's original file
 * at the artist's original resolution. Nothing here ever serves an upload untouched.
 */
export const DECAL = "d";
export const DECAL_SIZE = 512;

/** Every tile a garment of this kind is cut into. */
export function tileIds(kind: MerchKind): string[] {
  if (kind === "TSHIRT") return [DECAL];
  // SHIRT and PANTS use the identical three nets - a shirt wears them as torso and
  // arms, pants as torso and legs. Same rectangles, same tiles, same code.
  return Object.keys(PARTS).flatMap((p) => FACE_ORDER.map((f) => `${p}.${f}`));
}

/** Where a tile is cut from, in template pixels. Null for the decal, which is whole. */
export function tileRect(tileId: string): Rect | null {
  if (tileId === DECAL) return null;

  const [part, face] = tileId.split(".");
  const net = PARTS[part];
  if (!net) return null;
  if (!FACE_ORDER.includes(face as keyof Net)) return null;

  return net[face as keyof Net];
}

/** Is this tile one that a garment of this kind actually has? */
export function tileBelongs(tileId: string, kind: MerchKind): boolean {
  return tileIds(kind).includes(tileId);
}

// ---- The seal -------------------------------------------------------------

/**
 * The key. Derived from AUTH_SECRET, so it rotates when that does and there is no
 * second secret to lose - but domain-separated, so a token from this system can never
 * be confused with a session ticket signed by the same value.
 */
function key(): Buffer {
  const secret = process.env.AUTH_SECRET;
  // Loud, and at the first tile rather than at some later decrypt: with a missing
  // secret every token would still seal (against an empty key) and every one of them
  // would be forgeable by anybody who guessed that.
  if (!secret) throw new Error("AUTH_SECRET is not set - merch tiles cannot be sealed.");
  return createHash("sha256").update(`${secret}|merch-plate-v1`).digest();
}

/**
 * Seal `<productId>|<tileId>` into a URL-safe token.
 *
 * The IV is DERIVED from the plaintext rather than random, which is what makes the
 * token stable and therefore cacheable. That is only safe because the plaintext is
 * unique per token - one product, one tile, one message - so no two different
 * plaintexts ever share an IV, which is the actual rule GCM cares about. Do not be
 * tempted to reuse this helper for anything where the same plaintext gets sealed
 * twice and is expected to look different.
 */
export function sealTile(productId: string, tileId: string): string {
  const k = key();
  const plain = Buffer.from(`${productId}|${tileId}`, "utf8");

  const iv = createHmac("sha256", k).update(plain).digest().subarray(0, 12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);

  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

/** Open a token, or null if it was not one of ours. Never throws. */
export function openTile(token: string): { productId: string; tileId: string } | null {
  try {
    const raw = Buffer.from(token, "base64url");
    // 12 IV + 16 tag + at least a byte of payload. Anything shorter is a probe.
    if (raw.length < 29) return null;

    const k = key();
    const decipher = createDecipheriv("aes-256-gcm", k, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));

    const plain = Buffer.concat([
      decipher.update(raw.subarray(28)),
      // Throws on a bad tag. That is the authentication: a token somebody edited by a
      // byte does not decrypt to something slightly different, it does not decrypt.
      decipher.final(),
    ]).toString("utf8");

    const at = plain.indexOf("|");
    if (at <= 0) return null;

    return { productId: plain.slice(0, at), tileId: plain.slice(at + 1) };
  } catch {
    return null;
  }
}

export const plateUrl = (token: string) => `/api/merch/plate/${token}`;

/**
 * Every tile of one product, as `tileId -> url`. What the product page hands the
 * viewer instead of a texture.
 */
export function plateFor(
  productId: string,
  kind: MerchKind,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of tileIds(kind)) out[id] = plateUrl(sealTile(productId, id));
  return out;
}

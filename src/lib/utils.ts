export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** Turn a title into a URL-safe slug. */
export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * PREFIX-XXXXXXXX ticket code, using unambiguous characters.
 *
 * The prefix is the brand that issued it - "RN" for RO. Nation LIVE, or the
 * partner's `ticketPrefix` from the registry ("ST-4K9QW2"). It is decoration,
 * not identity: codes are unique across the whole `tickets` table regardless of
 * prefix, so nothing looks a ticket up by parsing one. It just means a holder
 * (and a door steward) can see at a glance whose show it is for.
 *
 * Eight characters, not six. The code is one of the two things that admit a
 * holder (the other is the ticket's DB status), so it must resist guessing: a
 * holder of a scoped TICKETS_VERIFY/REDEEM key can grind /verify with random
 * codes, and 31^6 (~2^29.7) is thin. 31^8 (~2^39.6) puts practical enumeration
 * out of reach. Codes are looked up by exact case-insensitive match with no
 * length assumption anywhere, so widening is backward-compatible.
 */
export function generateTicketCode(prefix = "RN") {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length];
  return `${prefix}-${out}`;
}

/**
 * Public survey code: XXXXX-XXXXXXX-XXX (5-7-3).
 *
 * Uses the same unambiguous alphabet as ticket codes - no O/0, I/1, L - because
 * these get read aloud and typed in by hand. 31^15 combinations, so guessing one
 * is not a realistic way to find a survey.
 */
export function generateSurveyCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(15);
  crypto.getRandomValues(bytes);

  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return [
    chars.slice(0, 5).join(""),
    chars.slice(5, 12).join(""),
    chars.slice(12, 15).join(""),
  ].join("-");
}

/** Does a path look like a bare survey code, e.g. "/ABCDE-FGHJKMN-PQR"? */
export const SURVEY_CODE_RE = /^[A-Z0-9]{5}-[A-Z0-9]{7}-[A-Z0-9]{3}$/i;

/** Split a multi-line textarea value into trimmed, non-empty lines. */
export function toLines(value: string) {
  return value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * A Roblox user's public profile page.
 *
 * Pure, so it lives here rather than in lib/roblox-users.ts - that module opens with
 * `import "server-only"` because it calls Roblox's API, and dragging it into a client
 * component to build one URL fails the build. Which is the guard working: an isomorphic
 * helper does not belong in a server-only file.
 */
export const robloxProfileUrl = (robloxId: string) =>
  `https://www.roblox.com/users/${robloxId}/profile`;

import { env } from "./env";

/** Constant-time-ish comparison to avoid trivial timing leaks. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Validate the `x-api-key` header (or `Authorization: Bearer <key>`) for the
 * in-game API. Returns true only when a key is configured and matches.
 */
export function isValidGameKey(req: Request) {
  if (!env.gameApiKey) return false;
  const headerKey =
    req.headers.get("x-api-key") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  if (!headerKey) return false;
  return safeEqual(headerKey, env.gameApiKey);
}

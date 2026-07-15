import "server-only";
import { prisma } from "@/lib/db";

// A fixed-window rate limiter, kept in Postgres.
//
// The contact action's own comment used to concede it had "nowhere to keep state"
// for a rate limiter and reach for a sign-in instead. It does have somewhere: the
// same Postgres every other write already uses. This is that store - one atomic
// upsert per check, so two requests racing the same key cannot both read "0" and
// both pass.
//
// Window semantics: each key holds a count and a resetAt. A hit inside the window
// increments; the first hit after resetAt starts a fresh window at 1. Simple and
// cheap - not a sliding window, which is not worth a second table here.

export type RateLimitResult = {
  /** True when this hit is within the limit. */
  ok: boolean;
  /** Hits left in the current window (0 when blocked). */
  remaining: number;
  /** When the current window resets. */
  resetAt: Date;
};

/**
 * Count one hit against `key` and report whether it is allowed.
 *
 * FAIL-OPEN. If the database is unreachable, or the rate_limits table does not yet
 * exist (it is created by `prisma db push` on boot), this ALLOWS the request rather
 * than blocking it. A limiter that takes the site down when its own storage hiccups
 * is a worse outage than the abuse it exists to stop - and if the database really is
 * down, the actual write the caller wanted fails on its own regardless.
 */
export async function rateLimit(
  key: string,
  opts: { limit: number; windowSeconds: number },
): Promise<RateLimitResult> {
  const { limit, windowSeconds } = opts;
  try {
    // One statement, atomic under the row lock ON CONFLICT takes. The CASE resets
    // the window in place when the old one has expired, so there is no read-modify-
    // write race and no separate "reset" path to run.
    const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO "rate_limits" ("key", "count", "resetAt")
      VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "rate_limits"."resetAt" <= now() THEN 1
          ELSE "rate_limits"."count" + 1
        END,
        "resetAt" = CASE
          WHEN "rate_limits"."resetAt" <= now() THEN now() + make_interval(secs => ${windowSeconds})
          ELSE "rate_limits"."resetAt"
        END
      RETURNING "count", "resetAt"
    `;

    const row = rows[0];
    const count = Number(row.count);
    return {
      ok: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt: row.resetAt,
    };
  } catch (err) {
    console.warn("[rate-limit] check failed, allowing request:", err);
    return {
      ok: true,
      remaining: limit,
      resetAt: new Date(Date.now() + windowSeconds * 1000),
    };
  }
}

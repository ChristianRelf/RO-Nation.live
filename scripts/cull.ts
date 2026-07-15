/**
 * The daily cull - delete the rows that were only ever meant to live for minutes.
 *
 *   npm run cull                # commits. This is what the cron service runs.
 *   npm run cull -- --dry-run   # counts what WOULD go, changes nothing.
 *
 * ---- What this touches, and why it is safe --------------------------------
 *
 * Only THROWAWAY state - three tables that grow forever and are read by nobody
 * once they are stale. Business data (tickets, purchases, enquiries, guides, the
 * audit trail) is never touched here. If a row is a record of something that
 * happened, it is not this script's business; if it is a lock or a counter whose
 * whole life is measured in minutes, it is.
 *
 *   sso_tickets      A spent-ticket row exists ONLY to make a 60-second SSO ticket
 *                    single-use. Past its expiresAt the ticket is refused on its own
 *                    exp anyway, so the row protects nothing - it is pure residue.
 *                    (lib/sso.ts already sweeps these opportunistically on redeem;
 *                    this is the floor under that, for a quiet week with few redeems.)
 *
 *   rate_limits      One row per bucket key ("enquiry:<uid>", "apikey:<id>"),
 *                    updated in place. It does not grow with traffic - but it DOES
 *                    grow with distinct keys, and a one-time visitor's bucket lingers
 *                    forever. Once its window has ended the row is dead: the next hit
 *                    re-creates it via upsert. Deleting an ended window is invisible.
 *
 *   purchase_intents A ten-minute seat hold. Every reader already ignores an expired
 *                    one (there is no sweeper; see lib/tickets/intents.ts), so an
 *                    expired PENDING or a CANCELLED hold is dead weight. A CONSUMED
 *                    one is a receipt that is read back via `launchData` while its
 *                    show is live - so those are kept well past the event, then culled.
 *
 * Deleting rows does not shrink the table on disk by itself - Postgres autovacuum
 * reclaims the space for reuse, which is what keeps these tables flat over time. For
 * a one-off on-disk compaction after a big backlog, run `VACUUM FULL` by hand in a
 * maintenance window (it takes a brief exclusive lock, so not from here).
 */
import { IntentStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY = process.argv.includes("--dry-run");

const DAY = 24 * 60 * 60 * 1000;

// How long a dead hold lingers before it is culled. Expired PENDING and CANCELLED
// holds are useless after ten minutes; a day's grace leaves them visible for
// same-day debugging without letting them pile up.
const INTENT_TERMINAL_GRACE_DAYS = 1;
// A CONSUMED hold is a receipt re-read via launchData while its show runs. A month
// is comfortably past any event, after which it is history nothing reads.
const INTENT_CONSUMED_KEEP_DAYS = 30;

async function sweep(
  label: string,
  del: () => Promise<number>,
  count: () => Promise<number>,
): Promise<number> {
  const n = DRY ? await count() : await del();
  console.log(
    `  ${DRY ? "would delete" : "deleted"} ${n.toLocaleString()} · ${label}`,
  );
  return n;
}

async function main() {
  const now = new Date();
  const terminalCutoff = new Date(now.getTime() - INTENT_TERMINAL_GRACE_DAYS * DAY);
  const consumedCutoff = new Date(now.getTime() - INTENT_CONSUMED_KEEP_DAYS * DAY);

  console.log(
    `\n=== cull @ ${now.toISOString()}${DRY ? " (DRY RUN - nothing changes)" : ""} ===`,
  );

  let total = 0;

  total += await sweep(
    "sso_tickets past expiry",
    () =>
      prisma.ssoTicket
        .deleteMany({ where: { expiresAt: { lt: now } } })
        .then((r) => r.count),
    () => prisma.ssoTicket.count({ where: { expiresAt: { lt: now } } }),
  );

  total += await sweep(
    "rate_limits with an ended window",
    () =>
      prisma.rateLimit
        .deleteMany({ where: { resetAt: { lt: now } } })
        .then((r) => r.count),
    () => prisma.rateLimit.count({ where: { resetAt: { lt: now } } }),
  );

  // Expired dead holds, plus receipts long past their show. One `where` so the
  // count and the delete can never describe different rows.
  const intentWhere = {
    OR: [
      {
        status: { in: [IntentStatus.PENDING, IntentStatus.CANCELLED] },
        expiresAt: { lt: terminalCutoff },
      },
      { status: IntentStatus.CONSUMED, createdAt: { lt: consumedCutoff } },
    ],
  };
  total += await sweep(
    "purchase_intents (expired holds + old receipts)",
    () =>
      prisma.purchaseIntent
        .deleteMany({ where: intentWhere })
        .then((r) => r.count),
    () => prisma.purchaseIntent.count({ where: intentWhere }),
  );

  console.log(
    `=== ${DRY ? "would remove" : "removed"} ${total.toLocaleString()} rows ===\n`,
  );
}

main()
  .catch((err) => {
    // A cron must not crash-loop on a bad night. Log it, exit non-zero so the run is
    // visibly failed in the logs, and let tomorrow's run try again - the deletes are
    // idempotent, so a missed day simply removes a little more the next.
    console.error("✗ cull failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

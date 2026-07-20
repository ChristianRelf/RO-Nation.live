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
 *   link_codes       A rotating six-digit Discord-link code lives 20 seconds
 *                    (lib/discord-link.ts). It is replaced in place while a member
 *                    watches the page, but the last one they leave behind lingers past
 *                    its expiry - dead the moment it lapses, and swept here.
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
 *   survey_uploads   ONLY the ones with no responseId - a file picked for a survey
 *                    answer and never submitted, because the tab was closed or it was
 *                    swapped for another. An upload attached to a response is somebody's
 *                    ANSWER and is never touched here, at any age.
 *
 *                    This is the one sweep that also deletes BYTES, since the row is the
 *                    only thing that knows where they are - drop it alone and the file is
 *                    unreferenced on the private volume forever. Bytes first, then the
 *                    row: the other order can lose the pointer and strand the file.
 *
 * Deleting rows does not shrink the table on disk by itself - Postgres autovacuum
 * reclaims the space for reuse, which is what keeps these tables flat over time. For
 * a one-off on-disk compaction after a big backlog, run `VACUUM FULL` by hand in a
 * maintenance window (it takes a brief exclusive lock, so not from here).
 */
import { unlink } from "fs/promises";
import path from "path";
import { IntentStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY = process.argv.includes("--dry-run");

const DAY = 24 * 60 * 60 * 1000;

// Not imported from lib/uploads.ts: that module is "server-only", which is a build
// constraint for the Next app and not something a plain tsx script satisfies. Two
// lines, and they must agree with it - PRIVATE_UPLOAD_DIR and resolveInRoot().
const PRIVATE_UPLOAD_DIR =
  process.env.PRIVATE_UPLOAD_DIR || path.join(process.cwd(), "private-uploads");

/** The traversal guard, same as lib/uploads.ts. A column is not a trusted path. */
function resolveInRoot(root: string, storagePath: string): string | null {
  const base = path.resolve(root);
  const target = path.resolve(base, storagePath);
  if (target !== base && !target.startsWith(base + path.sep)) return null;
  return target;
}

// How long an unattached survey upload lingers. Long enough that somebody filling
// in a long form over a lunch break does not have their attachments swept out from
// under them mid-answer; short enough that abandoned files are not a disk leak.
const SURVEY_UPLOAD_GRACE_HOURS = 24;

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

  total += await sweep(
    "link_codes past expiry",
    () =>
      prisma.linkCode
        .deleteMany({ where: { expiresAt: { lt: now } } })
        .then((r) => r.count),
    () => prisma.linkCode.count({ where: { expiresAt: { lt: now } } }),
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

  // Abandoned survey attachments. Not a sweep() like the others, because this one
  // has bytes to remove as well as rows and so cannot be a single deleteMany.
  total += await sweepSurveyUploads(
    new Date(now.getTime() - SURVEY_UPLOAD_GRACE_HOURS * 60 * 60 * 1000),
  );

  console.log(
    `=== ${DRY ? "would remove" : "removed"} ${total.toLocaleString()} rows ===\n`,
  );
}

/**
 * Delete unattached survey uploads older than `cutoff`, bytes included.
 *
 * `responseId: null` is the whole safety of this: a row gets its responseId the
 * moment its answer is submitted (actions/survey.ts, in the same transaction as
 * the response), so anything still null is a file nobody ever attached to
 * anything. A submitted attachment cannot match this `where` at any age.
 *
 * ---- Why the row goes before the bytes, one row at a time -----------------
 *
 * The scan and the delete are not the same instant, and a respondent can submit
 * in between: they leave the form open past the grace period, findMany picks
 * their upload up as abandoned, and a second later they hit Submit.
 *
 * So the delete is what DECIDES, not the scan. Each row is deleted on its own,
 * with `responseId: null` re-applied - the database resolves the race, and a row
 * claimed since the scan simply matches nothing and is left alone. Only once that
 * delete has actually removed a row, which means it was still unclaimed, are its
 * bytes touched.
 *
 * Sweeping the bytes first would invert the failure: a file claimed mid-loop gets
 * unlinked, then the guarded deleteMany correctly skips its row, and the result is
 * a submitted answer linking to bytes that no longer exist. That is somebody's CV
 * deleted out of a response they successfully sent - far worse than the leak this
 * order risks, which is a stray file when unlink fails after its row is gone.
 */
async function sweepSurveyUploads(cutoff: Date) {
  const doomed = await prisma.surveyUpload.findMany({
    where: { responseId: null, createdAt: { lt: cutoff } },
    select: { id: true, storagePath: true },
  });

  if (DRY) {
    console.log(
      `  would delete ${doomed.length.toLocaleString()} · survey_uploads never submitted (+ their files)`,
    );
    return doomed.length;
  }

  let gone = 0;
  for (const row of doomed) {
    const { count } = await prisma.surveyUpload.deleteMany({
      where: { id: row.id, responseId: null },
    });
    // Claimed between the scan and now. Not ours to remove.
    if (!count) continue;
    gone += count;

    const target = resolveInRoot(PRIVATE_UPLOAD_DIR, row.storagePath);
    // A missing file is the normal case for a row whose bytes were already
    // removed by the respondent hitting "Remove". Nothing to report.
    if (target) await unlink(target).catch(() => {});
  }

  console.log(
    `  deleted ${gone.toLocaleString()} · survey_uploads never submitted (+ their files)`,
  );
  return gone;
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

/**
 * The pre-show reminder sweep - nudge everyone holding a ticket to a show that is
 * about to happen.
 *
 *   npm run remind      # sends. This is what the cron service runs, hourly.
 *
 * It raises an on-site notice (MemberNotification, kind EVENT_REMINDER) for every
 * holder of a PUBLISHED show starting within the next REMINDER_WINDOW_HOURS. Run it
 * as often as you like: reminderSentAt makes each show send exactly once, so an
 * hourly cron and a hand re-run cannot double up (see lib/reminders.ts).
 *
 * Sits beside scripts/cull.ts as the other scheduled job. Unlike cull it WRITES
 * business rows (notifications), so it has no --dry-run: there is nothing to
 * preview that is not just "who is due", which `npm run remind` prints anyway.
 */
import { sendDueReminders } from "@/lib/reminders";
import { prisma } from "@/lib/db";

async function main() {
  const now = new Date();
  console.log(`\n=== remind @ ${now.toISOString()} ===`);
  const { shows, notices } = await sendDueReminders(now);
  console.log(
    `  reminded ${shows.toLocaleString()} show${shows === 1 ? "" : "s"} · ` +
      `${notices.toLocaleString()} notice${notices === 1 ? "" : "s"} sent`,
  );
  console.log(`=== done ===\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

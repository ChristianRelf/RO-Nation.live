/**
 * Take the demo content off the live site.
 *
 *   docker compose exec web npm run purge:demo            # dry run - changes nothing
 *   docker compose exec web npm run purge:demo -- --commit
 *
 * ---- What this is cleaning up ----------------------------------------------
 *
 * prisma/seed.ts used to run on every container boot and create nine PUBLISHED rows out
 * of thin air: five RNL shows that never happened (MIDNIGHT FREQUENCY, GRID CLASH, NEON
 * BLOCK PARTY...) with invented venues and capacities, and four OPEN job roles nobody
 * was hiring for. It also upserted two fictional Sleep Token shows onto a REAL PARTNER'S
 * LIVE SITE, unconditionally, every single boot.
 *
 * The seed is deleted. This removes what it left behind.
 *
 * ---- RUN THE CODE DEPLOY FIRST. THEN THIS. ---------------------------------
 *
 * Not a style preference - the old seed had a guard that re-armed itself:
 *
 *     const existing = await prisma.event.count({ where: { partnerId: null } });
 *     if (existing > 0) return;                       // skip the demo seed
 *
 * It skipped the demo only while at least one RNL event existed. Purge the five fake
 * events on a container still running the old code and that count drops to zero - so the
 * NEXT BOOT creates them all again. And seedPartner() sat above the guard entirely, so
 * Sleep Token's two shows came back every time regardless.
 *
 * So: deploy the code that has no seed, THEN run this. In the other order you will
 * delete the same five events twice and wonder why.
 *
 * ---- Why it archives instead of deleting -----------------------------------
 *
 * Application.career is `onDelete: Cascade`. Career.status OPEN means the role was
 * PUBLICLY LISTED - and "Event Host" has been sitting on /careers with a working apply
 * form on it. Somebody may well have applied. Deleting the fake career would delete a
 * real person's application, silently, and there would be no way to know it had ever
 * existed.
 *
 * Ticket.event is `onDelete: Cascade` for the same reason on the events side.
 *
 * So the rule, and it is hardcoded here rather than being a flag somebody can get wrong:
 *
 *     no attachments  ->  DELETE     (it was never real to anyone)
 *     attachments     ->  ARCHIVE    (it was real to somebody)
 *
 * Archiving is enough, because the public queries already filter on status:
 *
 *   getUpcomingEvents / getPastEvents / getFeaturedEvent  ->  status: "PUBLISHED"
 *   getEventBySlug                                        ->  null for ARCHIVED
 *   getOpenCareers                                        ->  status: "OPEN"
 *
 * ...so an ARCHIVED event vanishes from every public surface WHILE THE TICKET HOLDER'S
 * WALLET STILL RESOLVES IT, and a CLOSED career still opens for anybody holding the link
 * - which getCareerBySlug does deliberately, "so the page can say this one has closed
 * rather than 404". Exactly right for someone who applied to a job that was never real.
 *
 * Nothing else is touched. MerchProduct, Guide, BrandAsset, Post, Survey, ApiKey,
 * RosterEntry and PartnerContent are all clean - nothing fake was ever seeded into them.
 */

import { EventStatus, JobStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const COMMIT = process.argv.includes("--commit");

/**
 * The demo rows, lifted out of prisma/seed.ts before it was deleted.
 *
 * `partnerId` is checked as well as the slug, and that is not belt-and-braces: slugs are
 * globally unique across every org, so if RNL ever legitimately runs a show called NEON
 * BLOCK PARTY, this script must not quietly archive it. A row that matches the slug but
 * not the scope is not the demo row - it is somebody's real work, and the script says so
 * and leaves it alone.
 */
const DEMO_EVENTS: { slug: string; partnerId: string | null }[] = [
  { slug: "midnight-frequency", partnerId: null },
  { slug: "summer-live-showcase", partnerId: null },
  { slug: "grid-clash-tournament", partnerId: null },
  { slug: "neon-block-party", partnerId: null },
  { slug: "afterhours-vol-3", partnerId: null },
  // A real partner's live site. See the warning printed at the end.
  { slug: "stro-the-first-rite", partnerId: "sleeptokenro" },
  { slug: "stro-vessels-night", partnerId: "sleeptokenro" },
];

/** RNL's own roles. The compound key is [partnerId, slug], and RNL's half is NULL. */
const DEMO_CAREERS = [
  "event-host",
  "stage-builder",
  "social-media-manager",
  "moderation-team",
];

type Action = "delete" | "archive" | "absent" | "skip";

const MARK: Record<Action, string> = {
  delete: "✗ delete ",
  archive: "▣ archive",
  absent: "· absent ",
  skip: "! SKIP   ",
};

let deleted = 0;
let archived = 0;
let heldBack = 0;

async function purgeEvents() {
  console.log("\nEVENTS\n");

  for (const demo of DEMO_EVENTS) {
    const event = await prisma.event.findUnique({
      where: { slug: demo.slug },
      select: { id: true, slug: true, title: true, partnerId: true, status: true },
    });

    if (!event) {
      console.log(`  ${MARK.absent} ${demo.slug}`);
      continue;
    }

    // Same slug, different owner. Not our row.
    if ((event.partnerId ?? null) !== demo.partnerId) {
      console.log(
        `  ${MARK.skip} ${event.slug} - belongs to ${event.partnerId ?? "RNL"}, not ${demo.partnerId ?? "RNL"}. Left alone.`,
      );
      heldBack++;
      continue;
    }

    // Every ticket, including cancelled ones: a cancelled ticket is still a record that
    // a real person engaged with this show, and a hard delete would erase it.
    const tickets = await prisma.ticket.count({ where: { eventId: event.id } });

    if (tickets === 0) {
      console.log(`  ${MARK.delete} ${event.title}  (${event.slug})`);
      if (COMMIT) await prisma.event.delete({ where: { id: event.id } });
      deleted++;
      continue;
    }

    console.log(
      `  ${MARK.archive} ${event.title}  (${event.slug}) - ${tickets} ticket(s), so the row stays`,
    );
    if (COMMIT) {
      await prisma.event.update({
        where: { id: event.id },
        data: { status: EventStatus.ARCHIVED, featured: false },
      });
    }
    archived++;
  }
}

async function purgeCareers() {
  console.log("\nCAREERS\n");

  for (const slug of DEMO_CAREERS) {
    // findFirst, not findUnique: the unique key is [partnerId, slug], and Prisma's
    // compound-unique lookup will not take a null - which is exactly what RNL's half of
    // that key is. The seed hit the same wall and left a comment about it.
    const career = await prisma.career.findFirst({
      where: { slug, partnerId: null },
      select: { id: true, slug: true, title: true, status: true },
    });

    if (!career) {
      console.log(`  ${MARK.absent} ${slug}`);
      continue;
    }

    const applications = await prisma.application.count({
      where: { careerId: career.id },
    });

    if (applications === 0) {
      console.log(`  ${MARK.delete} ${career.title}  (${career.slug})`);
      if (COMMIT) await prisma.career.delete({ where: { id: career.id } });
      deleted++;
      continue;
    }

    console.log(
      `  ${MARK.archive} ${career.title}  (${career.slug}) - ${applications} REAL APPLICATION(S), so the row stays`,
    );
    if (COMMIT) {
      await prisma.career.update({
        where: { id: career.id },
        data: { status: JobStatus.CLOSED },
      });
    }
    archived++;
  }
}

async function main() {
  console.log(
    COMMIT
      ? "\n=== PURGING DEMO CONTENT ===\n"
      : "\n=== DRY RUN - nothing will be changed. Add --commit to act. ===\n",
  );

  await purgeEvents();
  await purgeCareers();

  console.log(
    `\n${deleted} to delete, ${archived} to archive, ${heldBack} skipped.\n`,
  );

  // The bit a script cannot decide.
  const strays = await prisma.ticket.count({
    where: {
      event: { slug: { in: ["stro-the-first-rite", "stro-vessels-night"] } },
    },
  });
  if (strays > 0) {
    console.warn("⚠ SLEEP TOKEN\n");
    console.warn(
      `  ${strays} person(s) hold a ticket to a Sleep Token show that was never real -\n` +
        `  a date the seed invented, on a live partner's site. Archiving hides the show\n` +
        `  but their ticket still resolves in their wallet, pointing at nothing.\n\n` +
        `  That is a conversation with Sleep Token, not a migration. Have it.\n`,
    );
  }

  if (!COMMIT && (deleted || archived)) {
    console.log("Nothing was changed. Re-run with --commit when the above looks right.\n");
  }

  if (COMMIT) {
    const remaining = await prisma.event.count({
      where: { partnerId: null, status: EventStatus.PUBLISHED },
    });
    console.log(
      `RNL now has ${remaining} published event(s). ` +
        (remaining === 0
          ? "The site will say so honestly rather than inventing five.\n"
          : "\n"),
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

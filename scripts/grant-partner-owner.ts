/**
 * Grant somebody a seat in a partner's portal.
 *
 *   docker compose exec web npm run partner:member -- <slug> <roblox-user> [role]
 *   docker compose exec web npm run partner:member -- sleeptokenro SomeUser
 *   docker compose exec web npm run partner:member -- sleeptokenro 123456789 MANAGER
 *
 * ---- Why this exists -------------------------------------------------------
 *
 * A slug in lib/partners/registry.ts grants NOBODY anything - the registry says the
 * partner exists, and a PartnerMember row says who may open their portal. Those are
 * different questions on purpose (see the note at the top of the registry).
 *
 * Until now the only thing that had ever written that row was prisma/seed.ts, which ran
 * on every container boot and also republished a pile of demo content nobody had chosen
 * to publish. The seed is gone. This is the half of it that was actually load-bearing,
 * kept as an explicit act you run on purpose rather than a side-effect of a restart.
 *
 * It is a BRIDGE, not the destination: /company/partners is the real tool. Until that
 * ships, this is the only way to onboard a partner without hand-writing SQL.
 *
 * ---- What it does ----------------------------------------------------------
 *
 *   1. refuses a slug that is not a live partner in the registry
 *   2. resolves the Roblox user for real, against Roblox - so the id, the username and
 *      the avatar are the ones Roblox has, not the ones somebody typed. The seed took
 *      the display name from an env var and believed it.
 *   3. upserts the PartnerMember row
 *
 * Idempotent. Running it twice on the same person is a no-op, and running it with a
 * different role changes the role.
 *
 * ---- A note on `role` ------------------------------------------------------
 *
 * Defaults to OWNER, because the only reason to reach for this script is that a partner
 * has nobody who can sign in at all - and an OWNER is the only role that can then grant
 * the rest. STAFF and MANAGER are accepted so this is a complete replacement for what
 * the seed could do, not a partial one.
 *
 * RNL staff at PARTNER_STAFF_RANK (250) already open every partner portal as OWNER via
 * the override in lib/partners/guard.ts - so this is for the PARTNER's own crew, who are
 * not in RNL's group and never will be.
 */

import { PartnerRole, PrismaClient } from "@prisma/client";
import { partnerBySlug } from "@/lib/partners/registry";
import { resolveRobloxUser } from "@/lib/roblox-users";

const prisma = new PrismaClient();

const ROLES = Object.values(PartnerRole) as string[];

function usage(message: string): never {
  console.error(`\n✗ ${message}\n`);
  console.error("  Usage: npm run partner:member -- <slug> <roblox-user> [role]");
  console.error("         npm run partner:member -- sleeptokenro SomeUser");
  console.error("         npm run partner:member -- sleeptokenro 123456789 MANAGER\n");
  console.error(`  role is one of ${ROLES.join(" | ")} (default OWNER).\n`);
  process.exit(1);
}

async function main() {
  // `npm run x -- a b` puts a and b in argv after the script path.
  const [slugArg, userArg, roleArg] = process.argv.slice(2);

  if (!slugArg || !userArg) usage("A partner slug and a Roblox user are required.");

  // The registry is the gate. An unregistered slug is not a partner with no members -
  // it is a typo, and writing the row anyway would produce a grant to a portal that
  // does not exist and cannot be found again.
  const partner = partnerBySlug(slugArg);
  if (!partner) {
    usage(
      `"${slugArg}" is not a live partner. Add it to src/lib/partners/registry.ts first.`,
    );
  }

  const role = (roleArg ?? "OWNER").toUpperCase();
  if (!ROLES.includes(role)) usage(`"${roleArg}" is not a role.`);

  console.log(`→ Resolving "${userArg}" against Roblox...`);

  // Never trust the caller's idea of who this is - the same rule addRosterEntry follows.
  // A username is a label somebody can change; the id is the person.
  const profile = await resolveRobloxUser(userArg);
  if (!profile) {
    console.error(`\n✗ Roblox has no user called "${userArg}".`);
    console.error("  Check the spelling, or pass the numeric id from their profile URL.\n");
    process.exit(1);
  }

  const existing = await prisma.partnerMember.findUnique({
    where: {
      partnerId_robloxId: { partnerId: partner.slug, robloxId: profile.robloxId },
    },
  });

  await prisma.partnerMember.upsert({
    where: {
      partnerId_robloxId: { partnerId: partner.slug, robloxId: profile.robloxId },
    },
    // The username and avatar are refreshed on every run: somebody who renamed on Roblox
    // should not sit in the members list under a name that no longer exists.
    update: {
      role: role as PartnerRole,
      robloxUsername: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    },
    create: {
      partnerId: partner.slug,
      robloxId: profile.robloxId,
      robloxUsername: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      role: role as PartnerRole,
      // Attributed to the script rather than to a person, because there is no session
      // here. /company/partners will stamp the real staff member who granted it.
      addedById: "cli",
      addedByName: "RO. Nation LIVE (cli)",
    },
  });

  const verb = existing
    ? existing.role === role
      ? "unchanged"
      : `changed from ${existing.role}`
    : "added";

  console.log(
    `\n✓ ${profile.displayName} (@${profile.username}, ${profile.robloxId}) is ${role} of ${partner.name} - ${verb}.`,
  );
  console.log(`  They can now sign in at portal.ronation.live/${partner.slug}\n`);

  const owners = await prisma.partnerMember.count({
    where: { partnerId: partner.slug, role: PartnerRole.OWNER },
  });
  if (owners === 0) {
    console.warn(
      `⚠ ${partner.name} now has NO owner. Nobody there can grant or revoke members.\n`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

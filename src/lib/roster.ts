import "server-only";
import type { Prisma, RosterKind } from "@prisma/client";
import { prisma } from "./db";

// Every function here takes the scope as its FIRST argument, and none of them
// has a default. That is deliberate: an unscoped roster query does not fail
// loudly and it does not come back empty - it comes back with *another
// organisation's blacklist*, looking for all the world like it worked. Making
// the scope impossible to forget is the only version of this that stays safe
// as the code grows.

/**
 * One search box covers everything a manager might remember about an entry:
 * the Roblox name, the numeric id, a role/tag, the reason text, or who added
 * them. Matching is case-insensitive except on the id.
 */
export function rosterWhere(
  partnerId: string,
  kind: RosterKind,
  q?: string,
): Prisma.RosterEntryWhereInput {
  const query = q?.trim().replace(/^@/, "");
  if (!query) return { partnerId, kind };

  return {
    partnerId,
    kind,
    OR: [
      { robloxUsername: { contains: query, mode: "insensitive" } },
      { displayName: { contains: query, mode: "insensitive" } },
      { robloxId: { contains: query } },
      { reason: { contains: query, mode: "insensitive" } },
      { addedByName: { contains: query, mode: "insensitive" } },
      // Postgres array containment is exact, so try both cases of the term.
      { tags: { hasSome: [query, query.toLowerCase()] } },
    ],
  };
}

export function findRoster(partnerId: string, kind: RosterKind, q?: string) {
  return prisma.rosterEntry.findMany({
    where: rosterWhere(partnerId, kind, q),
    orderBy: { createdAt: "desc" },
  });
}

export function countRoster(partnerId: string, kind: RosterKind) {
  return prisma.rosterEntry.count({ where: { partnerId, kind } });
}

/** This org's change history, most recent first. */
export function findRosterAudit(partnerId: string, take = 200) {
  return prisma.rosterAudit.findMany({
    where: { partnerId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

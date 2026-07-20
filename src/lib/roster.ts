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

/** How many entries one page of a roster shows. */
export const ROSTER_PAGE_SIZE = 50;

/**
 * A page of one org's list, most recently added first.
 *
 * `limit` is REQUIRED, for the same reason `partnerId` is: an unbounded roster
 * query does not fail loudly either. It works perfectly for a year and then a
 * blacklist that grew to five thousand people renders five thousand cards, and
 * the page that dies is the one somebody is standing at a door trying to use.
 * A caller that genuinely wants everything (an export) can ask for a big take -
 * but it has to say so.
 */
export function findRoster(
  partnerId: string,
  kind: RosterKind,
  q: string | undefined,
  limit: { take: number; skip?: number },
) {
  return prisma.rosterEntry.findMany({
    where: rosterWhere(partnerId, kind, q),
    orderBy: { createdAt: "desc" },
    take: limit.take,
    skip: limit.skip,
  });
}

/**
 * How many entries match. Pass `q` to count the SEARCH, omit it for the list
 * total - paging needs the former ("page 3 of 7 matches") and the header shows
 * the latter ("of 312 people").
 */
export function countRoster(partnerId: string, kind: RosterKind, q?: string) {
  return prisma.rosterEntry.count({ where: rosterWhere(partnerId, kind, q) });
}

/** This org's change history, most recent first. */
export function findRosterAudit(partnerId: string, take = 200) {
  return prisma.rosterAudit.findMany({
    where: { partnerId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

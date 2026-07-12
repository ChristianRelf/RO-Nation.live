import "server-only";
import type { Prisma, RosterKind } from "@prisma/client";
import { prisma } from "./db";

/**
 * One search box covers everything a manager might remember about an entry:
 * the Roblox name, the numeric id, a role/tag, the reason text, or who added
 * them. Matching is case-insensitive except on the id.
 */
export function rosterWhere(
  kind: RosterKind,
  q?: string,
): Prisma.RosterEntryWhereInput {
  const query = q?.trim().replace(/^@/, "");
  if (!query) return { kind };

  return {
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

export function findRoster(kind: RosterKind, q?: string) {
  return prisma.rosterEntry.findMany({
    where: rosterWhere(kind, q),
    orderBy: { createdAt: "desc" },
  });
}

export function countRoster(kind: RosterKind) {
  return prisma.rosterEntry.count({ where: { kind } });
}

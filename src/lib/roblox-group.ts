import "server-only";
import { env } from "./env";

// Roblox group membership, from the public groups API. It is the gate on every
// door: /company (rank >= COMPANY_MIN_RANK), the SHASHA portal (>= SHASHA_MIN_RANK
// to read, >= SHASHA_MANAGER_RANK to write), and the staff override that opens
// every partner portal (>= PARTNER_STAFF_RANK). See lib/env.ts for the ladder.

const GROUPS_API = "https://groups.roblox.com/v2";

export type GroupMembership = {
  /** 0–255. Guest is 0, owner is 255. */
  rank: number;
  /** The role's display name, e.g. "Producer". */
  roleName: string;
};

// Rank is checked on page renders and on every write, so it is cached briefly
// per user rather than hitting Roblox each time. A promotion or demotion takes
// effect within TTL_MS - quick enough to be fair, cheap enough to be sane.
const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; value: GroupMembership | null }>();

/** Cached per group as well as per user - the two gates may point at different groups. */
const cacheKey = (groupId: string, robloxId: string) => `${groupId}:${robloxId}`;

/**
 * The user's role in a group, or null if they aren't in it.
 *
 * A network failure returns null (no access) rather than throwing - the gate
 * fails closed, never open. Failures are deliberately NOT cached, so a blip at
 * Roblox locks someone out for one request rather than for the whole TTL.
 */
export async function getGroupMembership(
  robloxId: string,
  groupId: string = env.company.groupId,
): Promise<GroupMembership | null> {
  if (!/^\d+$/.test(robloxId)) return null;

  const key = cacheKey(groupId, robloxId);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  let body: {
    data?: {
      group?: { id?: number };
      role?: { name?: string; rank?: number };
    }[];
  };

  try {
    const res = await fetch(`${GROUPS_API}/users/${robloxId}/groups/roles`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    body = await res.json();
  } catch {
    return null;
  }

  const entry = body.data?.find((g) => String(g.group?.id) === groupId);
  const value: GroupMembership | null = entry?.role
    ? { rank: entry.role.rank ?? 0, roleName: entry.role.name ?? "Member" }
    : null;

  // Only a definitive answer from Roblox is worth remembering.
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Drop a cached rank so the next check re-reads it from Roblox. */
export function forgetGroupMembership(
  robloxId: string,
  groupId: string = env.company.groupId,
) {
  cache.delete(cacheKey(groupId, robloxId));
}

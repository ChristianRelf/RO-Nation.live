import "server-only";
import { env } from "./env";

// Roblox group membership, from the public groups API. Used to decide who can
// open the Studio: members of the configured group at rank >= STUDIO_MIN_RANK.

const GROUPS_API = "https://groups.roblox.com/v2";

export type GroupMembership = {
  /** 0–255. Guest is 0, owner is 255. */
  rank: number;
  /** The role's display name, e.g. "Producer". */
  roleName: string;
};

// Rank is checked on page renders and on every write, so it is cached briefly
// per user rather than hitting Roblox each time. A promotion or demotion takes
// effect within TTL_MS — quick enough to be fair, cheap enough to be sane.
const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; value: GroupMembership | null }>();

/**
 * The user's role in the configured group, or null if they aren't in it.
 *
 * A network failure returns null (no access) rather than throwing — the gate
 * fails closed, never open. Failures are deliberately NOT cached, so a blip at
 * Roblox locks someone out for one request rather than for the whole TTL.
 */
export async function getGroupMembership(
  robloxId: string,
): Promise<GroupMembership | null> {
  if (!/^\d+$/.test(robloxId)) return null;

  const hit = cache.get(robloxId);
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

  const entry = body.data?.find(
    (g) => String(g.group?.id) === env.studio.groupId,
  );
  const value: GroupMembership | null = entry?.role
    ? { rank: entry.role.rank ?? 0, roleName: entry.role.name ?? "Member" }
    : null;

  // Only a definitive answer from Roblox is worth remembering.
  cache.set(robloxId, { at: Date.now(), value });
  return value;
}

/** Drop a cached rank so the next check re-reads it from Roblox. */
export function forgetGroupMembership(robloxId: string) {
  cache.delete(robloxId);
}

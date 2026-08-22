import "server-only";

// Talks to Roblox on behalf of an arbitrary group - a sponsor or community RNL wants to
// credit on partner.ronation.live, identified only by its Roblox group id. Distinct from
// lib/roblox-group.ts, which is about ONE group (RNL's own) and answers an access-control
// question ("is this user in it, at what rank"); this file answers a display question, for
// however many groups an admin has added.
//
// Same fail-soft rule as lib/merch/roblox.ts and getGroupMemberCount in roblox-group.ts: a
// number or a picture nobody can verify must not appear on the page, so a network blip
// returns null rather than a fabricated zero or a stale one dressed up as current.

const TIMEOUT_MS = 10_000;

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "ronation.live partner groups",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Belt and braces: this must never get memoised into a page render by accident.
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export type GroupDetails = {
  name: string;
  memberCount: number;
};

/**
 * A group's name and member count, straight from Roblox.
 *
 * Used both to fill a card in when it's first added and to re-sync one later - the name is
 * never trusted from the admin's typing, only the id is theirs, and Roblox says what it's
 * called.
 */
export async function fetchGroupDetails(groupId: string): Promise<GroupDetails | null> {
  if (!/^\d+$/.test(groupId)) return null;

  const data = await getJson<{ name?: string; memberCount?: number }>(
    `https://groups.roblox.com/v1/groups/${groupId}`,
  );

  if (!data?.name || typeof data.memberCount !== "number") return null;
  return { name: data.name, memberCount: data.memberCount };
}

/** A group's icon, or null if Roblox has nothing rendered for it yet. */
export async function fetchGroupIcon(groupId: string): Promise<string | null> {
  const url = new URL("https://thumbnails.roblox.com/v1/groups/icons");
  url.searchParams.set("groupIds", groupId);
  url.searchParams.set("size", "150x150");
  url.searchParams.set("format", "Png");

  const data = await getJson<{
    data?: { targetId: number; state: string; imageUrl?: string }[];
  }>(url.toString());

  // "Completed" is the only state with a picture behind it - see the identical check in
  // lib/merch/roblox.ts's thumbnails().
  const entry = data?.data?.[0];
  return entry?.state === "Completed" && entry.imageUrl ? entry.imageUrl : null;
}

export type ResolvedGroup = {
  name: string;
  memberCount: number;
  iconUrl: string | null;
};

/** Name, member count and icon in one call - what an admin's "add" or "re-sync" needs. */
export async function resolvePartnerGroup(groupId: string): Promise<ResolvedGroup | null> {
  const details = await fetchGroupDetails(groupId);
  if (!details) return null;

  const iconUrl = await fetchGroupIcon(groupId);
  return { name: details.name, memberCount: details.memberCount, iconUrl };
}

// ---- Live member count, for the public page --------------------------------
//
// Cached per group, 30 minutes - the same reasoning as getGroupMemberCount in
// lib/roblox-group.ts: this is on the homepage of every visit and Roblox rate-limits the
// endpoint, but a stale count is honest where a fabricated one would not be. A blip
// returns null and the caller prints nothing, rather than a zero that reads as "empty".
const MEMBERS_TTL_MS = 30 * 60 * 1000;
const memberCounts = new Map<string, { at: number; value: number }>();

export async function getLiveMemberCount(groupId: string): Promise<number | null> {
  const hit = memberCounts.get(groupId);
  if (hit && Date.now() - hit.at < MEMBERS_TTL_MS) return hit.value;

  const details = await fetchGroupDetails(groupId);
  if (!details) return null;

  memberCounts.set(groupId, { at: Date.now(), value: details.memberCount });
  return details.memberCount;
}

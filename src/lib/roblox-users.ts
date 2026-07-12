import "server-only";

// Lookups against Roblox's public user + thumbnail APIs. No auth needed.
// Used by the SHASHA portal to resolve a typed username into a canonical
// Roblox id before it's written to the VIP list / blacklist, so entries can
// never be pinned to the wrong person (or drift when someone renames).

const USERS_API = "https://users.roblox.com/v1";
const THUMBS_API = "https://thumbnails.roblox.com/v1";

export type RobloxProfile = {
  robloxId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

const isNumericId = (v: string) => /^\d{1,20}$/.test(v);

async function getJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { ...init, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Headshot URLs for a batch of user ids, keyed by id. Never throws. */
export async function fetchAvatars(
  robloxIds: string[],
): Promise<Record<string, string>> {
  const ids = robloxIds.filter(isNumericId);
  if (!ids.length) return {};

  const data = await getJson<{
    data: { targetId: number; state: string; imageUrl: string }[];
  }>(
    `${THUMBS_API}/users/avatar-headshot?userIds=${ids.join(
      ",",
    )}&size=150x150&format=Png&isCircular=false`,
  );

  const out: Record<string, string> = {};
  for (const item of data?.data ?? []) {
    if (item.state === "Completed" && item.imageUrl) {
      out[String(item.targetId)] = item.imageUrl;
    }
  }
  return out;
}

async function withAvatar(
  user: { id: number | string; name: string; displayName?: string } | null,
): Promise<RobloxProfile | null> {
  if (!user) return null;
  const robloxId = String(user.id);
  const avatars = await fetchAvatars([robloxId]);
  return {
    robloxId,
    username: user.name,
    displayName: user.displayName || user.name,
    avatarUrl: avatars[robloxId] ?? null,
  };
}

/**
 * Resolve an exact Roblox username, or a numeric user id, to a profile.
 * Returns null when no such user exists.
 */
export async function resolveRobloxUser(
  input: string,
): Promise<RobloxProfile | null> {
  const query = input.trim().replace(/^@/, "");
  if (!query) return null;

  if (isNumericId(query)) {
    const user = await getJson<{
      id: number;
      name: string;
      displayName: string;
    }>(`${USERS_API}/users/${query}`);
    return withAvatar(user);
  }

  const body = await getJson<{
    data: { id: number; name: string; displayName: string }[];
  }>(`${USERS_API}/usernames/users`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      usernames: [query],
      excludeBannedUsers: false,
    }),
  });

  return withAvatar(body?.data?.[0] ?? null);
}

/**
 * Typeahead search by partial username. Roblox's keyword search is rate-limited
 * and occasionally unavailable, so we fall back to an exact-username lookup —
 * meaning the picker still works even when search is down.
 */
export async function searchRobloxUsers(
  keyword: string,
  limit = 8,
): Promise<RobloxProfile[]> {
  const query = keyword.trim().replace(/^@/, "");
  if (query.length < 3 && !isNumericId(query)) return [];

  if (isNumericId(query)) {
    const exact = await resolveRobloxUser(query);
    return exact ? [exact] : [];
  }

  // Roblox only accepts a limit of 10/25/50/100 — ask for 10 and trim.
  const results = await getJson<{
    data: { id: number; name: string; displayName: string }[];
  }>(`${USERS_API}/users/search?keyword=${encodeURIComponent(query)}&limit=10`);

  const users = results?.data?.slice(0, limit) ?? [];
  if (!users.length) {
    const exact = await resolveRobloxUser(query);
    return exact ? [exact] : [];
  }

  const avatars = await fetchAvatars(users.map((u) => String(u.id)));
  return users.map((u) => ({
    robloxId: String(u.id),
    username: u.name,
    displayName: u.displayName || u.name,
    avatarUrl: avatars[String(u.id)] ?? null,
  }));
}

export const robloxProfileUrl = (robloxId: string) =>
  `https://www.roblox.com/users/${robloxId}/profile`;

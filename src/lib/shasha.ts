import "server-only";
import { redirect } from "next/navigation";
import { env } from "./env";
import { getUserSession, type UserSession } from "./session";
import { getGroupMembership, type GroupMembership } from "./roblox-group";

// Who can use the SHASHA portal: anyone signed in with Roblox who holds rank
// SHASHA_MIN_RANK or above in the group. Rank SHASHA_MANAGER_RANK and above may
// also write — add, edit and remove people on the VIP list and the blacklist.
//
// Rank is read from Roblox (briefly cached), never from the session cookie, so
// a demotion takes effect on its own. There is no allowlist to maintain: the
// group IS the allowlist, and promoting someone in it is the whole grant.
//
// This deliberately mirrors lib/studio.ts. Two gates, same shape, one place to
// learn — rather than a second, differently-shaped auth system.

export type PortalRole = "manager" | "staff";

export type PortalUser = UserSession & {
  rank: number;
  roleName: string;
  role: PortalRole;
  /** Managers only. Read-only staff can search the lists but not change them. */
  canWrite: boolean;
};

export type PortalAccess =
  | { state: "anonymous" }
  | { state: "denied"; session: UserSession; membership: GroupMembership | null }
  | { state: "allowed"; user: PortalUser };

export async function getPortalAccess(): Promise<PortalAccess> {
  const session = await getUserSession();
  if (!session) return { state: "anonymous" };

  const membership = await getGroupMembership(
    session.robloxId,
    env.shasha.groupId,
  );
  if (!membership || membership.rank < env.shasha.minRank) {
    return { state: "denied", session, membership };
  }

  const role: PortalRole =
    membership.rank >= env.shasha.managerRank ? "manager" : "staff";

  return {
    state: "allowed",
    user: {
      ...session,
      rank: membership.rank,
      roleName: membership.roleName,
      role,
      canWrite: role === "manager",
    },
  };
}

/** The signed-in portal user, or null. Cheap enough to call from a layout. */
export async function getPortalUser(): Promise<PortalUser | null> {
  const access = await getPortalAccess();
  return access.state === "allowed" ? access.user : null;
}

/**
 * Guard for portal pages and server actions. Every guarded page must call this
 * itself before reading data — see the note on requireAdmin() in lib/session.ts
 * for why a layout guard alone leaks the page's RSC payload.
 */
export async function requirePortalUser(): Promise<PortalUser> {
  const user = await getPortalUser();
  if (!user) redirect("/shasha/login");
  return user;
}

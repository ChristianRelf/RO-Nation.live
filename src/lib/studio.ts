import "server-only";
import { redirect } from "next/navigation";
import { env } from "./env";
import { getUserSession, type UserSession } from "./session";
import { getGroupMembership, type GroupMembership } from "./roblox-group";

// Who can use the Studio: anyone signed in with Roblox who holds rank
// STUDIO_MIN_RANK or above in the configured Roblox group.
//
// Rank is read from Roblox (briefly cached), never from the session cookie —
// so a demotion takes effect on its own, without the person having to sign out.

export type StudioUser = UserSession & {
  rank: number;
  roleName: string;
};

export type StudioAccess =
  | { state: "anonymous" }
  | { state: "denied"; session: UserSession; membership: GroupMembership | null }
  | { state: "allowed"; user: StudioUser };

export async function getStudioAccess(): Promise<StudioAccess> {
  const session = await getUserSession();
  if (!session) return { state: "anonymous" };

  const membership = await getGroupMembership(session.robloxId);
  if (!membership || membership.rank < env.studio.minRank) {
    return { state: "denied", session, membership };
  }

  return {
    state: "allowed",
    user: { ...session, rank: membership.rank, roleName: membership.roleName },
  };
}

/** The signed-in Studio user, or null. Cheap enough to call from a layout. */
export async function getStudioUser(): Promise<StudioUser | null> {
  const access = await getStudioAccess();
  return access.state === "allowed" ? access.user : null;
}

/**
 * Guard for Studio pages and server actions. Every guarded page must call this
 * itself before reading data — see the note on requireAdmin() in lib/session.ts
 * for why a layout guard alone leaks the page's RSC payload.
 */
export async function requireStudioUser(): Promise<StudioUser> {
  const user = await getStudioUser();
  if (!user) redirect("/studio/access");
  return user;
}

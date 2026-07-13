import "server-only";
import { redirect } from "next/navigation";
import { env } from "./env";
import { getUserSession, type UserSession } from "./session";
import { getGroupMembership, type GroupMembership } from "./roblox-group";

// Who can use the Company (/company): anyone signed in with Roblox who holds
// rank COMPANY_MIN_RANK or above in RNL's group. This is the ONLY door onto
// ronation.live's own content — events, blog, surveys, careers, applications.
//
// It replaced a shared username+password admin login. That was one secret, held
// by several people, that rotated never and told the audit log nothing about who
// had actually pressed the button. A rank is per-person, revoked by demotion,
// and every write is now attributable to a Roblox account.
//
// Rank is read from Roblox (briefly cached), never from the session cookie — so
// a demotion takes effect on its own, without the person having to sign out.
//
// This deliberately mirrors lib/shasha.ts. Two gates, same shape, one place to
// learn — rather than a second, differently-shaped auth system.

export type CompanyUser = UserSession & {
  rank: number;
  roleName: string;
};

export type CompanyAccess =
  | { state: "anonymous" }
  | { state: "denied"; session: UserSession; membership: GroupMembership | null }
  | { state: "allowed"; user: CompanyUser };

export async function getCompanyAccess(): Promise<CompanyAccess> {
  const session = await getUserSession();
  if (!session) return { state: "anonymous" };

  const membership = await getGroupMembership(
    session.robloxId,
    env.company.groupId,
  );
  if (!membership || membership.rank < env.company.minRank) {
    return { state: "denied", session, membership };
  }

  return {
    state: "allowed",
    user: { ...session, rank: membership.rank, roleName: membership.roleName },
  };
}

/** The signed-in Company user, or null. Cheap enough to call from a layout. */
export async function getCompanyUser(): Promise<CompanyUser | null> {
  const access = await getCompanyAccess();
  return access.state === "allowed" ? access.user : null;
}

/**
 * Guard for Company pages and server actions. Every guarded page must call this
 * itself before reading data — see the note on the page guards in lib/session.ts
 * for why a layout guard alone leaks the page's RSC payload.
 */
export async function requireCompanyUser(): Promise<CompanyUser> {
  const user = await getCompanyUser();
  if (!user) redirect("/company/access");
  return user;
}

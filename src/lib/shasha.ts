import "server-only";
import { redirect } from "next/navigation";
import { PartnerRole } from "@prisma/client";
import { prisma } from "./db";
import { env } from "./env";
import { getUserSession, type UserSession } from "./session";
import { getGroupMembership, type GroupMembership } from "./roblox-group";

// Who can use the SHASHA portal.
//
// Two ways in, and a person needs only one of them:
//
//   RANK    Signed in with Roblox and holding SHASHA_MIN_RANK or above in the
//           group. SHASHA_MANAGER_RANK and above may also write. Read from
//           Roblox on every request (briefly cached), never from the session
//           cookie, so a demotion takes effect on its own.
//
//   GRANT   An explicit PartnerMember row scoped to SHASHA_SCOPE, written from
//           the Studio at /company/shasha.
//
// The grant exists because the group was the ONLY allowlist, which is fine right
// up until the person who needs the door is not in RNL's group and should not be
// ranked in it - a contractor on one show, somebody's manager, a promoter running
// their own door for a night. The alternative was promoting them in the Roblox
// group, which grants far more than a look at a blacklist and is remembered by
// nobody afterwards.
//
// They COMPOSE, and only ever upwards: whichever of the two says more, wins. A
// grant cannot demote a ranked manager, and a rank cannot revoke a grant. That
// mirrors how partners/guard.ts already resolves a partner's row against their
// group rank - one rule, learned once.
//
// This still mirrors lib/company.ts in shape. Two gates, one place to learn.

/**
 * RNL's own portal, as a `partnerId` value.
 *
 * Safe as a sentinel because the registry's RESERVED set forbids any partner
 * from taking the "shasha" slug, so it can never collide with a real one. Lives
 * here rather than in portal-scope.ts because that module imports THIS one -
 * the constant has to sit at the bottom of the dependency, not the top.
 */
export const SHASHA_SCOPE = "shasha";

export type PortalRole = "manager" | "staff";

export type PortalUser = UserSession & {
  /** Their rank in RNL's group. 0 for somebody who is in it at no rank at all. */
  rank: number;
  roleName: string;
  role: PortalRole;
  /** Managers only. Read-only staff can search the lists but not change them. */
  canWrite: boolean;
  /**
   * True when the group rank alone would NOT have let them in - they are here on
   * a grant. Presentation only; nothing authorises off it.
   */
  granted: boolean;
};

/**
 * The explicit grant for this person, if any.
 *
 * OWNER is folded into MANAGER on purpose. SHASHA membership is administered
 * from the Studio by company users and nowhere else, so there is no "may grant
 * others" tier to be had here - /company/shasha offers Staff and Manager only.
 * A stray OWNER row (the CLI will still write one) therefore reads as MANAGER
 * rather than as something undefined.
 */
async function grantedRole(robloxId: string): Promise<PartnerRole | null> {
  const row = await prisma.partnerMember.findUnique({
    where: { partnerId_robloxId: { partnerId: SHASHA_SCOPE, robloxId } },
    select: { role: true },
  });
  return row?.role ?? null;
}

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

  const rankOpens = Boolean(membership) && membership!.rank >= env.shasha.minRank;
  const rankWrites = rankOpens && membership!.rank >= env.shasha.managerRank;

  // Read only when it could change the answer.
  //
  // A ranked manager is already at the top tier, and no grant can add to that -
  // so it is not worth a query. Which matters more than it looks: hasAnyScope()
  // calls this on EVERY request for EVERY byte a PDF viewer asks for, and the
  // people reading the docs all day are exactly the ones this skips. Anybody
  // else pays one indexed lookup on a unique key.
  const grant = rankWrites ? null : await grantedRole(session.robloxId);

  if (!rankOpens && !grant) {
    return { state: "denied", session, membership };
  }

  const canWrite =
    rankWrites || grant === PartnerRole.MANAGER || grant === PartnerRole.OWNER;

  return {
    state: "allowed",
    user: {
      ...session,
      rank: membership?.rank ?? 0,
      // Somebody on a grant alone has no rank to name. Saying so beats printing
      // a role they do not hold.
      roleName: membership?.roleName ?? "Granted access",
      role: canWrite ? "manager" : "staff",
      canWrite,
      granted: !rankOpens,
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
 * itself before reading data - see the note on the page guards in lib/session.ts
 * for why a layout guard alone leaks the page's RSC payload.
 */
export async function requirePortalUser(): Promise<PortalUser> {
  const user = await getPortalUser();
  if (!user) redirect("/shasha/login");
  return user;
}

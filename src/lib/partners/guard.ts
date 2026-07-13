import "server-only";
import { notFound, redirect } from "next/navigation";
import type { PartnerRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getGroupMembership } from "@/lib/roblox-group";
import { getUserSession, type UserSession } from "@/lib/session";
import {
  partnerBySlug,
  partnerHasFeature,
  type Partner,
  type PartnerFeature,
} from "./registry";
import { partnerPortalPath } from "./urls";

// Who can use a partner's portal (portal.ronation.live/<slug>).
//
// This is the "partner guard" the middleware's header note points at: nothing
// is derived from x-ron-brand, which is presentation only. Access is re-read
// from the database on every request, here.
//
// There are exactly two ways in, and the asymmetry between them is the point.
//
//   The partner's own people   An explicit PartnerMember row RNL grants. It is
//                              NOT a rank in the partner's Roblox group: RNL
//                              does not own that group, cannot see who is in it,
//                              and cannot stop them promoting whoever they like
//                              — so ranking off it would let a partner mint
//                              access to RNL's infrastructure at will. A slug in
//                              the registry grants nobody anything (the registry
//                              says so itself); the row is the grant, and
//                              deleting it is the revocation.
//
//   RNL staff                  A rank in RNL's OWN group, which RNL does control
//                              — so here the group genuinely IS the allowlist,
//                              exactly as in lib/shasha.ts. Rank 250+ opens every
//                              partner portal. See the override below.

export type PartnerUser = UserSession & {
  partner: Partner;
  role: PartnerRole;
  /** MANAGER and OWNER. Read-only STAFF can search the lists but not change them. */
  canWrite: boolean;
  /** OWNER only. Grant and revoke other members of this partner. */
  canManageMembers: boolean;
  /**
   * True when this is RNL staff on the group override rather than one of the
   * partner's own people. Presentation only — it changes what the portal says
   * about you, not what you may do. Both routes have already been authorised by
   * the time this is set.
   */
  isRnlStaff: boolean;
};

export type PartnerAccess =
  | { state: "anonymous"; partner: Partner }
  /** Signed in with Roblox, but holds no grant on this partner. */
  | { state: "denied"; partner: Partner; session: UserSession };

export type PartnerResult = PartnerAccess | { state: "allowed"; user: PartnerUser };

/**
 * Resolve what the current visitor may do on `slug`'s portal.
 *
 * Returns null when the slug is not a live partner at all, so a caller can
 * 404 rather than leak the difference between "no such partner" and "not your
 * partner".
 */
export async function getPartnerAccess(
  slug: string,
): Promise<PartnerResult | null> {
  const partner = partnerBySlug(slug);
  if (!partner) return null;

  const session = await getUserSession();
  if (!session) return { state: "anonymous", partner };

  const member = await prisma.partnerMember.findUnique({
    where: {
      partnerId_robloxId: {
        partnerId: partner.slug,
        robloxId: session.robloxId,
      },
    },
  });

  if (member) {
    return {
      state: "allowed",
      user: {
        ...session,
        partner,
        role: member.role,
        canWrite: member.role === "MANAGER" || member.role === "OWNER",
        canManageMembers: member.role === "OWNER",
        isRnlStaff: false,
      },
    };
  }

  // ---- The RNL staff override ---------------------------------------
  //
  // Rank PARTNER_STAFF_RANK or above in RNL's own group opens EVERY partner
  // portal, with no PartnerMember row and nothing to revoke by hand — RNL builds
  // and runs these sites, and needed a way in that didn't mean a database insert
  // per person per partner.
  //
  // It is checked SECOND, after the row, for two reasons. The row is a local
  // read and covers the common case (a partner's own staff, who are not in RNL's
  // group at all), so the usual request never touches the network. And a partner
  // who IS in RNL's group keeps the role their row gives them rather than being
  // silently promoted to owner by it.
  //
  // Owner-equivalent is the intent: RNL staff can already edit the registry,
  // deploy the app and read the database, so withholding the portal's own buttons
  // from them would be theatre. It is deliberately the highest rank in the ladder
  // because it is the one grant that reaches into organisations RNL does not own.
  if (await isRnlStaff(session.robloxId)) {
    return {
      state: "allowed",
      user: {
        ...session,
        partner,
        role: "OWNER",
        canWrite: true,
        canManageMembers: true,
        isRnlStaff: true,
      },
    };
  }

  return { state: "denied", partner, session };
}

/** Rank PARTNER_STAFF_RANK+ in RNL's group. Read live from Roblox, cached 5 min. */
async function isRnlStaff(robloxId: string): Promise<boolean> {
  const membership = await getGroupMembership(robloxId, env.partners.groupId);
  return Boolean(membership && membership.rank >= env.partners.staffRank);
}

/** The signed-in partner user, or null. Cheap enough to call from a layout. */
export async function getPartnerUser(slug: string): Promise<PartnerUser | null> {
  const access = await getPartnerAccess(slug);
  return access?.state === "allowed" ? access.user : null;
}

/**
 * Guard for partner portal pages and server actions.
 *
 * Every guarded page must call this ITSELF before it reads any data — a guard
 * in the layout alone is not enough. See the long note on the page guards in
 * lib/session.ts: page segments render in parallel with their layout, so a
 * layout-only redirect still ships the page's RSC payload (here: another
 * partner's blacklist) in the body of the 307 that bounced the request.
 */
export async function requirePartnerUser(slug: string): Promise<PartnerUser> {
  const user = await getPartnerUser(slug);
  if (!user) redirect(`${partnerPortalPath(slug)}/login`);
  return user;
}

/** Managers and owners only — the write tier. */
export async function requirePartnerManager(slug: string): Promise<PartnerUser> {
  const user = await requirePartnerUser(slug);
  if (!user.canWrite) redirect(`${partnerPortalPath(slug)}?error=readonly`);
  return user;
}

/**
 * 404 unless the partner actually has this feature.
 *
 * The registry is explicit that a feature a partner does not have "must 404, not
 * just hide its nav item" — hiding the link leaves the route standing, and a
 * route that exists is a route somebody reaches.
 */
export function assertPartnerFeature(partner: Partner, feature: PartnerFeature) {
  if (!partnerHasFeature(partner, feature)) notFound();
}

import "server-only";
import { notFound, redirect } from "next/navigation";
import type { PartnerRole } from "@prisma/client";
import { prisma } from "@/lib/db";
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
// It deliberately does NOT mirror lib/shasha.ts. SHASHA can say "the group IS
// the allowlist" because RNL owns that Roblox group: promoting someone in it is
// the whole grant, and there is no list to keep in sync. A partner is a
// different organisation. RNL does not own their group, cannot see who is in
// it, and cannot stop them promoting whoever they like — so ranking off it
// would let a partner mint access to RNL's infrastructure at will.
//
// Hence explicit grants. A slug in the registry grants nobody anything (the
// registry says so itself); a PartnerMember row is the grant, and deleting it
// is the revocation.

export type PartnerUser = UserSession & {
  partner: Partner;
  role: PartnerRole;
  /** MANAGER and OWNER. Read-only STAFF can search the lists but not change them. */
  canWrite: boolean;
  /** OWNER only. Grant and revoke other members of this partner. */
  canManageMembers: boolean;
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
  if (!member) return { state: "denied", partner, session };

  return {
    state: "allowed",
    user: {
      ...session,
      partner,
      role: member.role,
      canWrite: member.role === "MANAGER" || member.role === "OWNER",
      canManageMembers: member.role === "OWNER",
    },
  };
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
 * in the layout alone is not enough. See the long note on requireAdmin() in
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

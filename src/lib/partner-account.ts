import "server-only";
import { redirect } from "next/navigation";
import {
  PartnerAccountStatus,
  type PartnerAccount,
  type PartnerAccountMember,
} from "@prisma/client";
import { prisma } from "./db";
import { getUserSession, type UserSession } from "./session";

// Who can open partner.ronation.live/hub: a signed-in Roblox account that holds a
// PartnerAccountMember row. That row resolves to ONE PartnerAccount entity - a person or a
// company (see the schema) - which is the thing the whole area is about.
//
// This deliberately mirrors lib/company.ts and lib/shasha.ts: the same three-state shape, and
// the same "guard the page, never the layout alone" rule (see lib/session.ts). What differs is
// where access comes from - not a Roblox GROUP rank, but a grant row RNL writes from
// /company/partner-accounts, or one minted when somebody claims an invitation (see
// lib/partner-invites.ts). A PartnerAccount is not in RNL's group and never will be, which is
// the whole reason this is a table rather than a rank.

export type PartnerAccountUser = UserSession & {
  /** The entity this login belongs to - the person or company. */
  account: PartnerAccount;
  /** The membership row that let them in. */
  membership: PartnerAccountMember;
};

export type PartnerAccountAccess =
  | { state: "anonymous" }
  | { state: "denied"; session: UserSession }
  | { state: "allowed"; user: PartnerAccountUser };

export async function getPartnerAccountAccess(): Promise<PartnerAccountAccess> {
  const session = await getUserSession();
  if (!session) return { state: "anonymous" };

  const membership = await prisma.partnerAccountMember.findUnique({
    where: { robloxId: session.robloxId },
    include: { partnerAccount: true },
  });
  if (!membership) return { state: "denied", session };

  const { partnerAccount, ...rest } = membership;
  return {
    state: "allowed",
    user: { ...session, account: partnerAccount, membership: rest },
  };
}

/** The signed-in partner user, or null. Cheap enough to call from a layout. */
export async function getPartnerAccountUser(): Promise<PartnerAccountUser | null> {
  const access = await getPartnerAccountAccess();
  return access.state === "allowed" ? access.user : null;
}

/**
 * Guard for everything behind the gate on partner.ronation.live - /hub and /onboard - and for
 * their actions. Every guarded page must call this itself before reading data; see the note on
 * the page guards in lib/session.ts for why a layout guard alone still ships the page's RSC
 * payload.
 *
 * The redirect target is RELATIVE, and it has to be: /access is a path on whichever host this
 * runs on. That is the programme host, always - nothing else mounts these pages. lib/pay.ts
 * deliberately does NOT reuse this guard for exactly that reason; see the note there.
 */
export async function requirePartnerAccount(): Promise<PartnerAccountUser> {
  const user = await getPartnerAccountUser();
  if (!user) redirect("/access");
  return user;
}

/**
 * Every login that can sign in on one entity's behalf.
 *
 * Shown to the partner themselves, on their own overview. RNL writes this list from
 * /company/partner-accounts and the partner cannot change it - which is exactly why they
 * should be able to READ it: an account they no longer recognise is theirs to query, and
 * they can only query what they can see.
 *
 * Callers must scope this to the account the caller actually holds (requirePartnerAccount
 * returns it) - the id is the whole authorization, and this function checks nothing.
 */
export function listPartnerAccountMembers(
  partnerAccountId: string,
): Promise<PartnerAccountMember[]> {
  if (!partnerAccountId) return Promise.resolve([]);
  return prisma.partnerAccountMember.findMany({
    where: { partnerAccountId },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * A live PARTNER reads their accounting; a POTENTIAL partner reads only the agreements. The
 * /hub/accounting page and the Payments nav item both gate on this.
 */
export function isFullPartner(account: PartnerAccount): boolean {
  return account.status === PartnerAccountStatus.PARTNER;
}

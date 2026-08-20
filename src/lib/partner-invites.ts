import "server-only";
import { randomUUID } from "crypto";
import {
  PartnerAccountKind,
  PartnerAccountStatus,
  PartnerInviteStatus,
  Prisma,
  type PartnerInvite,
} from "@prisma/client";
import { prisma } from "./db";
import type { UserSession } from "./session";

// Invitations to become a partner - partner.ronation.live/invite/<uuid>.
//
// ---- What the uuid actually is ---------------------------------------------
//
// A BEARER CAPABILITY. Whoever holds the link can claim it, and claiming it mints a
// PartnerAccount with their Roblox login attached - which is a real grant: that account
// then reads RNL's agreements, its own accounting, and (once it is a full partner)
// pay.ronation.live. There is no second factor and there cannot be one, because the whole
// point is to hand it to somebody who has no account here yet.
//
// Everything in this module follows from that:
//
//   • It EXPIRES. An unclaimed link that works forever is a permanent grant sitting in
//     somebody's Discord history that the person who issued it has long since forgotten.
//   • It is REVOCABLE, separately from expiry, because "we changed our minds" and "nobody
//     used it in time" are different facts and staff want to see which happened.
//   • It is spent ATOMICALLY. Two tabs, or a double-click on a slow connection, must not
//     produce two partner accounts - see claimInvite() below.
//   • A bad code and a revoked code answer the SAME way to the person holding it. The
//     difference is only visible on the desk.

/** The shape of a code in the URL. Checked before any query - see inviteByCode. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** How long a fresh invite lasts, in days. Long enough to survive a holiday. */
export const INVITE_DAYS = 30;

export const INVITE_DAY_CHOICES = [7, 14, 30, 60, 90] as const;

export type InviteState =
  | "pending"
  | "expired"
  | "claimed"
  | "revoked"
  | "missing";

/**
 * What state an invite is in, expiry included.
 *
 * Expiry is DERIVED here rather than swept by a cron. A row that says PENDING with a date
 * in the past is not a bug - it is a row nobody has looked at - and reading the clock at
 * the point of use means there is no window in which an expired invite still works because
 * the sweeper has not run yet.
 */
export function inviteState(invite: PartnerInvite | null): InviteState {
  if (!invite) return "missing";
  if (invite.status === PartnerInviteStatus.REVOKED) return "revoked";
  if (invite.status === PartnerInviteStatus.CLAIMED) return "claimed";
  if (invite.expiresAt.getTime() <= Date.now()) return "expired";
  return "pending";
}

/**
 * Look an invite up by the code in the URL.
 *
 * The code is checked against the uuid shape BEFORE it reaches the database. Not for
 * safety - Prisma parameterises, so a junk string is simply a miss - but because this is
 * an unauthenticated endpoint anybody can hit in a loop, and a shape check costs nothing
 * while a query costs a connection.
 */
export function inviteByCode(code: string): Promise<PartnerInvite | null> {
  if (!UUID_RE.test(code)) return Promise.resolve(null);
  return prisma.partnerInvite.findUnique({ where: { code } });
}

export type ClaimResult =
  | { ok: true; partnerAccountId: string; created: boolean }
  /** The link itself is no good. `state` says how, for the page to explain. */
  | { ok: false; reason: "state"; state: InviteState }
  /** This Roblox account already belongs to a partner entity. See below. */
  | { ok: false; reason: "already"; partnerAccountId: string };

/**
 * Spend an invite: create the partner account and attach this login to it.
 *
 * ---- Why the guard is in the WHERE clause ----------------------------------
 *
 * The claim is an updateMany whose where-clause repeats every condition inviteState()
 * checks, and the count it returns is the decision. Reading the row, deciding in
 * JavaScript, and then writing is the textbook check-then-act race: two tabs both read
 * PENDING, both decide yes, and RNL has two partner accounts for one invitation, with the
 * second one silently unlinked from the invite. Postgres settles it instead - exactly one
 * of the two updates matches a row, and the loser gets zero.
 *
 * ---- Why the whole thing is one transaction --------------------------------
 *
 * Marking the invite CLAIMED and creating the account it claims are one fact. Split them
 * and a failure in between leaves an invite that is spent and an account that does not
 * exist - the single worst outcome available here, because the link is now dead and the
 * person holding it has nothing.
 *
 * ---- The one refusal that is not about the link ----------------------------
 *
 * PartnerAccountMember.robloxId is globally unique (see the schema note): one Roblox
 * account belongs to at most one partner entity. So somebody who is ALREADY a partner
 * cannot claim a second invite, and telling them "this link is invalid" would be a lie
 * about the link. They get their own answer, and the id of the account they already hold,
 * so the page can send them to it.
 */
export async function claimInvite(
  code: string,
  session: UserSession,
): Promise<ClaimResult> {
  if (!UUID_RE.test(code)) return { ok: false, reason: "state", state: "missing" };

  // Checked before the transaction opens, because it is the common refusal and it needs no
  // lock: a membership that exists now cannot stop existing under us, and one that appears
  // in the next millisecond is caught by the unique constraint below anyway.
  const existing = await prisma.partnerAccountMember.findUnique({
    where: { robloxId: session.robloxId },
    select: { partnerAccountId: true },
  });
  if (existing) {
    return {
      ok: false,
      reason: "already",
      partnerAccountId: existing.partnerAccountId,
    };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const now = new Date();

      const spent = await tx.partnerInvite.updateMany({
        where: {
          code,
          status: PartnerInviteStatus.PENDING,
          expiresAt: { gt: now },
        },
        data: {
          status: PartnerInviteStatus.CLAIMED,
          claimedAt: now,
          claimedByRobloxId: session.robloxId,
          claimedByName: session.displayName,
        },
      });

      if (spent.count !== 1) {
        // Somebody else won the race, or it was never claimable. Re-read to say which -
        // this is inside the transaction, so it is the state that actually applied.
        const invite = await tx.partnerInvite.findUnique({ where: { code } });
        return { ok: false, reason: "state", state: inviteState(invite) } as const;
      }

      const invite = await tx.partnerInvite.findUniqueOrThrow({ where: { code } });

      const account = await tx.partnerAccount.create({
        data: {
          kind: invite.kind,
          // Named from the invite's label, because that is what staff called them when
          // they cut it - and it is the name that will print on documents until somebody
          // corrects it from /company/partner-accounts.
          name: invite.label,
          // POTENTIAL, always, and never PARTNER. Claiming an invite means "we are talking";
          // becoming a full partner opens accounting and the pay host, and that is a
          // deliberate act by somebody with company rank, not a consequence of clicking a
          // link. See isFullPartner().
          status: PartnerAccountStatus.POTENTIAL,
          createdByRobloxId: invite.issuedByRobloxId,
          createdByName: invite.issuedByName,
        },
      });

      await tx.partnerAccountMember.create({
        data: {
          partnerAccountId: account.id,
          robloxId: session.robloxId,
          username: session.username,
          displayName: session.displayName,
          avatarUrl: session.avatarUrl,
          // Snapshotted as the ISSUER, not as the claimer. "Added by" answers who is
          // responsible for this login being able to sign in, and the answer is the
          // member of staff who sent the invitation.
          addedByRobloxId: invite.issuedByRobloxId,
          addedByName: invite.issuedByName,
        },
      });

      await tx.partnerInvite.update({
        where: { id: invite.id },
        data: { partnerAccountId: account.id },
      });

      return { ok: true, partnerAccountId: account.id, created: true } as const;
    });
  } catch (err) {
    // The unique constraint on robloxId, lost to a request that got there first. Read it
    // back rather than reporting a failure: from the person's side the outcome is the one
    // they wanted, on the account they now hold.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const member = await prisma.partnerAccountMember.findUnique({
        where: { robloxId: session.robloxId },
        select: { partnerAccountId: true },
      });
      if (member) {
        return {
          ok: false,
          reason: "already",
          partnerAccountId: member.partnerAccountId,
        };
      }
    }
    throw err;
  }
}

/**
 * A fresh code.
 *
 * The column defaults to uuid() in the database, so this exists for the one case that
 * default cannot serve: re-rolling a code on an invite that already has one, when a link
 * has been sent to the wrong person.
 */
export const newInviteCode = () => randomUUID();

/** `expiresAt` for an invite cut today, in days. Clamped to the offered choices. */
export function inviteExpiry(days: number): Date {
  const allowed: readonly number[] = INVITE_DAY_CHOICES;
  const d = allowed.includes(days) ? days : INVITE_DAYS;
  return new Date(Date.now() + d * 24 * 60 * 60 * 1000);
}

/** PERSON or COMPANY, from a form value. Anything else is a COMPANY. */
export function inviteKind(value: string): PartnerAccountKind {
  return value.toUpperCase() === PartnerAccountKind.PERSON
    ? PartnerAccountKind.PERSON
    : PartnerAccountKind.COMPANY;
}

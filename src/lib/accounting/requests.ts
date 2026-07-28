import "server-only";
import type { PaymentRequest } from "@prisma/client";
import { PaymentRequestKind, PaymentRequestStatus } from "@prisma/client";
import { prisma } from "../db";

// The only writer of payment_requests.
//
// Same shape as documents.ts, and for the same reason: the rules about what may change,
// and when, belong in one module rather than in whichever page remembered them. Three
// rules live here.
//
//   1. A REQUEST IS SCOPED TO ITS ENTITY, ALWAYS. Every read below takes a
//      partnerAccountId and puts it in the WHERE - never fetches by id and compares
//      afterwards. `findUnique({ where: { id } })` on a table of other people's money is
//      one forgotten `if` away from an IDOR, so the shape of the function does not allow
//      one to be forgotten. See getRequestFor().
//
//   2. ONLY AN OPEN REQUEST CHANGES. Reviewing and withdrawing are both scoped to
//      status: OPEN in the same statement that writes, so two staff clicking Accept at
//      once produce one acceptance and one "already handled", not two documents.
//
//   3. THE REQUESTER NEVER SETS STATUS. They create (OPEN) and they withdraw (their own,
//      still OPEN). Accept and decline take a company user and live behind the company
//      guard - see app/actions/payments.ts.

/** What the two forms on pay.ronation.live post, after validation. */
export type PaymentRequestInput = {
  kind: PaymentRequestKind;
  amountRobux: number;
  reference: string;
  detail?: string | null;
  externalRef?: string | null;
  expectedAt?: Date | null;
};

/** Who is asking - resolved from the session, never from the form. */
export type Requester = {
  partnerAccountId: string;
  partnerAccountName: string;
  robloxId: string;
  displayName: string;
};

/**
 * Raise a request. Always OPEN - there is no other state a counterparty can create.
 *
 * The entity and the person are taken from `by`, which the caller resolved from the
 * session. Nothing about who is asking comes off the form: a hidden partnerAccountId
 * field would be a hidden partnerAccountId field somebody could edit.
 */
export function createRequest(
  input: PaymentRequestInput,
  by: Requester,
): Promise<PaymentRequest> {
  return prisma.paymentRequest.create({
    data: {
      kind: input.kind,
      partnerAccountId: by.partnerAccountId,
      partnerAccountName: by.partnerAccountName,
      submittedByRobloxId: by.robloxId,
      submittedByName: by.displayName,
      amountRobux: input.amountRobux,
      reference: input.reference,
      detail: input.detail || null,
      externalRef: input.externalRef || null,
      expectedAt: input.expectedAt ?? null,
    },
  });
}

export type ReviewOutcome = "accepted" | "declined";

/**
 * The company's answer to a request.
 *
 * `updateMany` scoped to `status: OPEN` rather than read-then-write, exactly as
 * updateDraft is: the status check and the write are one statement, so a second reviewer
 * landing between them gets a count of 0 and is told it was already handled - rather than
 * overwriting the first answer and, on acceptance, raising a second document for the same
 * money.
 */
export async function reviewRequest(
  id: string,
  outcome: ReviewOutcome,
  by: { robloxId: string; displayName: string },
  opts: { note?: string | null; documentId?: string | null } = {},
): Promise<boolean> {
  const { count } = await prisma.paymentRequest.updateMany({
    where: { id, status: PaymentRequestStatus.OPEN },
    data: {
      status:
        outcome === "accepted"
          ? PaymentRequestStatus.ACCEPTED
          : PaymentRequestStatus.DECLINED,
      reviewedByRobloxId: by.robloxId,
      reviewedByName: by.displayName,
      reviewedAt: new Date(),
      // Trimmed to the same 500 as voidDocument's reason, and for the same reason: this
      // is a sentence a person reads, not a place to paste a thread.
      reviewNote: opts.note?.slice(0, 500) || null,
      documentId: opts.documentId ?? null,
    },
  });
  return count === 1;
}

/**
 * The requester taking it back.
 *
 * Scoped to their OWN entity and to OPEN in the WHERE - so this cannot withdraw somebody
 * else's request, and cannot un-decide one staff have already answered. Both conditions
 * are in the statement rather than checked first; see rule 1 at the top.
 */
export async function withdrawRequest(
  id: string,
  partnerAccountId: string,
): Promise<boolean> {
  const { count } = await prisma.paymentRequest.updateMany({
    where: { id, partnerAccountId, status: PaymentRequestStatus.OPEN },
    data: { status: PaymentRequestStatus.WITHDRAWN },
  });
  return count === 1;
}

// ---- Reads ---------------------------------------------------------------

/**
 * One request, scoped to the entity that may read it.
 *
 * `findFirst` with both in the WHERE, never findUnique-then-check. A wrong id and
 * somebody else's id give the same answer - null - so this cannot be used to discover
 * that a request exists, only to read one that is yours.
 */
export function getRequestFor(
  id: string,
  partnerAccountId: string,
): Promise<PaymentRequest | null> {
  if (!id || !partnerAccountId) return Promise.resolve(null);
  return prisma.paymentRequest.findFirst({ where: { id, partnerAccountId } });
}

/** One request, for STAFF. Unscoped, and only ever called behind the company guard. */
export function getRequest(id: string): Promise<PaymentRequest | null> {
  if (!id) return Promise.resolve(null);
  return prisma.paymentRequest.findUnique({ where: { id } });
}

/** Everything one entity has ever asked for, newest first - their own list. */
export function listRequestsFor(
  partnerAccountId: string,
): Promise<PaymentRequest[]> {
  if (!partnerAccountId) return Promise.resolve([]);
  return prisma.paymentRequest.findMany({
    where: { partnerAccountId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * The staff queue.
 *
 * Ordered OPEN-first and then newest-first, because this is a list to work from: the
 * thing nobody has answered yet is the thing that belongs at the top, and a strict
 * createdAt sort buries a request from this morning under a fortnight of settled ones.
 * Prisma cannot express "this enum value first", so the two reads are done separately and
 * concatenated - the alternative is raw SQL for a list that is capped at 200 anyway.
 */
export async function listRequests(
  status?: PaymentRequestStatus,
): Promise<PaymentRequest[]> {
  if (status) {
    return prisma.paymentRequest.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  const [open, rest] = await Promise.all([
    prisma.paymentRequest.findMany({
      where: { status: PaymentRequestStatus.OPEN },
      orderBy: { createdAt: "desc" },
    }),
    prisma.paymentRequest.findMany({
      where: { status: { not: PaymentRequestStatus.OPEN } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);
  return [...open, ...rest];
}

/** How many are waiting on somebody. The badge on the desk. */
export function openRequestCount(): Promise<number> {
  return prisma.paymentRequest.count({
    where: { status: PaymentRequestStatus.OPEN },
  });
}

/**
 * How many of ONE entity's requests are still unanswered. The badge on their own tab.
 *
 * Scoped in the WHERE, like every other read here. It is only a count - it leaks nothing
 * but a number - and it is scoped anyway, because a read that takes an entity id and does
 * not use it is a read somebody will later widen without noticing.
 */
export function countOpenRequestsFor(partnerAccountId: string): Promise<number> {
  if (!partnerAccountId) return Promise.resolve(0);
  return prisma.paymentRequest.count({
    where: { partnerAccountId, status: PaymentRequestStatus.OPEN },
  });
}

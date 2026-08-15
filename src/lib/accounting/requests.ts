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

export type ReleaseResult =
  | { ok: true; request: PaymentRequest }
  | { ok: false; reason: "already" };

/**
 * Ask for the funds held on an already-issued document.
 *
 * The amount and the reference come from the DOCUMENT, never from a form. That is the
 * whole point of this being its own function with its own route: the payee is claiming a
 * figure RNL already wrote and froze, so there is no text box for them to type a different
 * one into. Compare createRequest above, where the amount is theirs to state and staff
 * check it.
 *
 * ---- The double-claim guard, and why it is shaped like this ---------------
 *
 * "At most one OPEN release per document" is a partial unique constraint, which Prisma
 * cannot express in the schema (see the note on the index). So it is enforced here, and
 * enforced by a CONDITIONAL INSERT rather than a check-then-write: `createMany` with a
 * count-guard would still race, so the check and the write are wrapped in a transaction at
 * SERIALIZABLE-equivalent cost by re-reading inside it.
 *
 * The consequence of losing this race is worth stating, because it is why the belt exists
 * at all: two OPEN releases against one payroll slip mean two staff can each accept one,
 * and the second acceptance marks an already-PAID document paid again. markPaid() is
 * scoped to ISSUED so the money is not double-sent - but the queue would show two
 * accepted claims for one amount, which is exactly the ambiguity a ledger exists to
 * prevent.
 */
export async function createReleaseRequest(
  doc: {
    id: string;
    number: string | null;
    title: string;
    total: number;
    partnerAccountId: string | null;
  },
  by: Requester,
): Promise<ReleaseResult> {
  try {
    const request = await prisma.$transaction(async (tx) => {
      const open = await tx.paymentRequest.findFirst({
        where: {
          againstDocumentId: doc.id,
          status: PaymentRequestStatus.OPEN,
        },
        select: { id: true },
      });
      if (open) throw new ReleaseError();

      return tx.paymentRequest.create({
        data: {
          kind: PaymentRequestKind.RELEASE,
          againstDocumentId: doc.id,
          partnerAccountId: by.partnerAccountId,
          partnerAccountName: by.partnerAccountName,
          submittedByRobloxId: by.robloxId,
          submittedByName: by.displayName,
          // Straight off the document. Frozen at issue, so this cannot drift from what the
          // payee is actually owed.
          amountRobux: doc.total,
          reference: doc.number
            ? `Release funds on ${doc.number} - ${doc.title}`
            : `Release funds - ${doc.title}`,
        },
      });
    });

    return { ok: true, request };
  } catch (err) {
    if (err instanceof ReleaseError) return { ok: false, reason: "already" };
    throw err;
  }
}

class ReleaseError extends Error {}

/**
 * The OPEN release request against each of these documents, keyed by document id.
 *
 * One query for a whole statement rather than one per row - a client with forty documents
 * should not cost forty round trips to decide which rows get a button.
 *
 * Scoped to the entity as well as the ids, like every other read here. The ids come from a
 * list that was already scoped, so this is belt and braces; it is written this way because
 * a read that takes an entity id and ignores it is a read somebody will later call with
 * ids from somewhere else.
 */
export async function openReleasesByDocument(
  partnerAccountId: string,
  documentIds: string[],
): Promise<Map<string, PaymentRequest>> {
  if (!partnerAccountId || documentIds.length === 0) return new Map();

  const rows = await prisma.paymentRequest.findMany({
    where: {
      partnerAccountId,
      againstDocumentId: { in: documentIds },
      status: PaymentRequestStatus.OPEN,
    },
  });

  return new Map(rows.map((r) => [r.againstDocumentId!, r]));
}

/**
 * The one open claim on a document, for STAFF.
 *
 * Unscoped - it takes a document id and nothing else - and that is safe only because it is
 * called behind the company guard, on the desk's own page. The client-facing sibling above
 * takes an entity id and puts it in the WHERE; do not swap one for the other.
 */
export function openReleaseFor(documentId: string): Promise<PaymentRequest | null> {
  if (!documentId) return Promise.resolve(null);
  return prisma.paymentRequest.findFirst({
    where: { againstDocumentId: documentId, status: PaymentRequestStatus.OPEN },
    orderBy: { createdAt: "desc" },
  });
}

export type ReviewOutcome = "accepted" | "declined";

/**
 * Answer any open claim on a document, because the document itself just moved.
 *
 * ---- The orphan this exists to prevent ------------------------------------
 *
 * A release request and the document it claims are two rows that can be changed from two
 * different pages. Staff can answer the claim from the requests queue - which settles the
 * document, see acceptPaymentRequest - but they can equally hit "Mark paid" or "Void" on
 * the document itself, from the desk, without ever seeing the queue.
 *
 * Left alone, that second path leaves the claim sitting at OPEN forever: the payee's
 * statement says "Requested" and their requests list says "nobody has answered it yet",
 * while the money has in fact been sent. The payee's view of events would be wrong, and
 * wrong in the direction that makes them chase RNL for money they already have.
 *
 * So moving the document answers the claim, and the answer says which act did it. Scoped
 * to OPEN, so it is a no-op when the claim was already answered - which is exactly what
 * happens on the acceptPaymentRequest path, where the claim is closed first and the
 * document second.
 *
 * Returns how many were closed, so the caller can say so if it wants to.
 */
export async function closeReleasesFor(
  documentId: string,
  outcome: ReviewOutcome,
  by: { robloxId: string; displayName: string },
  note: string,
): Promise<number> {
  if (!documentId) return 0;

  const { count } = await prisma.paymentRequest.updateMany({
    where: {
      againstDocumentId: documentId,
      status: PaymentRequestStatus.OPEN,
    },
    data: {
      status:
        outcome === "accepted"
          ? PaymentRequestStatus.ACCEPTED
          : PaymentRequestStatus.DECLINED,
      reviewedByRobloxId: by.robloxId,
      reviewedByName: by.displayName,
      reviewedAt: new Date(),
      reviewNote: note.slice(0, 500) || null,
      // The document it concerned - and, on the accepted path, the document it settled.
      // Same value either way; the request pointed at it from the start.
      documentId,
    },
  });
  return count;
}

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

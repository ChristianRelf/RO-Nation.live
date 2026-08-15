"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import {
  DocumentKind,
  DocumentStatus,
  PaymentRequestKind,
  PaymentRequestStatus,
} from "@prisma/client";
import { requireCompanyUser, type CompanyUser } from "@/lib/company";
import { requirePayUser, requirePayUserPreTerms } from "@/lib/pay";
import { prisma } from "@/lib/db";
import {
  PAY_TERMS_CONFIRMATIONS,
  PAY_TERMS_VERSION,
  payTermsSnapshot,
} from "@/lib/accounting/pay-terms";
import {
  AuditAction,
  AuditActorKind,
  AuditTarget,
  recordAudit,
  COMPANY_SCOPE,
} from "@/lib/audit";
import { s, parseDate } from "@/lib/content";
import { parseRobux } from "@/lib/accounting/lines";
import { formatRobux } from "@/lib/tickets/pricing";
import {
  createReleaseRequest,
  createRequest,
  getRequest,
  reviewRequest,
  withdrawRequest,
} from "@/lib/accounting/requests";
import {
  isFreeFormRequest,
  parseRequestKind,
  requestKindConfig,
} from "@/lib/accounting/request-kinds";
import { kindConfig } from "@/lib/accounting/kinds";
import { createDraft, getDocument, markPaid } from "@/lib/accounting/documents";

// Every act on a payment request. TWO audiences write here, which is why the guard on
// each action is worth reading before changing one.
//
//   requirePayUser()          the client, on pay.ronation.live. May CREATE a request and
//                             WITHDRAW their own. Nothing else - see below. It is this
//                             guard rather than requirePartnerAccount() because it also
//                             carries the payment-terms gate (lib/pay.ts), and an action
//                             is reachable by a post that never rendered the page whose
//                             guard would have stopped it.
//   requirePayUserPreTerms()  the one exception: recording an acceptance OF that gate.
//   requireCompanyUser()      staff, on accounts.ronation.live. May accept or decline.
//
// ---- What a client is deliberately unable to do ---------------------------
//
// Set a status, name an entity other than their own, or cause a numbered document to
// exist. The first two are structural: status is never read off the form, and the entity
// comes from requirePartnerAccount() rather than from a hidden field - a hidden field is
// a field somebody can edit. The third is the important one. Accepting a request RAISES A
// DRAFT, and a draft still has to be checked and issued by a person with company rank
// before it is worth anything; nothing here mints a number, and nothing here can.
//
// ---- Why the redirects have no host in them -------------------------------
//
// Each action is called from exactly one host, and a relative redirect resolves against
// the host the request arrived on. So `/requests` means accounts.ronation.live/requests in
// the staff actions and pay.ronation.live/requests in the client ones. Getting this wrong
// does not error - it silently lands somebody on the other portal's 404 - so the actions
// are grouped by audience below and labelled.

// ==========================================================================
// The CLIENT's actions - pay.ronation.live
// ==========================================================================

export type RequestFormState = { error: string } | null;

/**
 * Raise a request - both forms post here, and `kind` decides which one it was.
 *
 * Returns its error rather than redirecting, like the document builder does: somebody who
 * has typed a reference and an amount should not lose both because the date was wrong.
 */
export async function submitPaymentRequest(
  _prev: RequestFormState,
  formData: FormData,
): Promise<RequestFormState> {
  // requirePayUser, not requirePartnerAccount: this is a pay.ronation.live action, and
  // that guard is the one that carries the terms gate. A form post is not stopped by the
  // page guard that would have redirected the person who sent it - so an action guarded
  // one level down is an action somebody can reach without ever having seen the terms.
  const user = await requirePayUser();

  const kind = parseRequestKind(s(formData, "kind"));
  if (!kind) return { error: "Unknown request type." };
  // The two free-form forms write PAYMENT and REQUEST only. A RELEASE reaching this path
  // would be a claim on held funds with a TYPED amount and no document behind it - which
  // is to say, no ceiling. It has its own route for exactly that reason.
  if (!isFreeFormRequest(kind)) {
    return { error: "That request is raised from a document, not from this form." };
  }

  // parseRobux with allowNegative left at its default false. Direction is `kind` and
  // only `kind`: a negative amount on a PAYMENT would be a payout wearing the wrong
  // heading, and it would pass every other check on this page.
  const amountRobux = parseRobux(s(formData, "amount"));
  if (amountRobux === null || amountRobux <= 0) {
    return { error: "Give an amount in Robux — a whole number, more than zero." };
  }

  const reference = s(formData, "reference");
  if (!reference) {
    return { error: "Say what this is for. A figure on its own isn't a request." };
  }

  const rawDate = s(formData, "expectedAt");
  const expectedAt = rawDate ? parseDate(rawDate) : null;
  // A date that was TYPED and could not be read is an error; no date at all is fine,
  // because the field is optional on both forms.
  if (rawDate && !expectedAt) return { error: "That date couldn't be read." };

  await createRequest(
    {
      kind,
      amountRobux,
      reference: reference.slice(0, 200),
      detail: s(formData, "detail").slice(0, 2000),
      externalRef: s(formData, "externalRef").slice(0, 200),
      expectedAt,
    },
    {
      partnerAccountId: user.account.id,
      partnerAccountName: user.account.name,
      robloxId: user.robloxId,
      displayName: user.displayName,
    },
  );

  revalidatePath("/pay/requests");
  revalidatePath("/pay");
  redirect("/requests?ok=submitted");
}

/**
 * Ask for the funds held on an issued payroll slip or credit note.
 *
 * ---- What is checked, and why each check is here --------------------------
 *
 * Everything below is re-derived from the DOCUMENT, server-side. The form posts one field
 * - an id - and nothing else, because every other fact about this claim (who it belongs
 * to, how much, whether it can be claimed at all) is already recorded and must not be
 * re-stated by the claimant.
 *
 *   SCOPE      the document's partnerAccountId must equal the caller's. This is the whole
 *              authorization, and it is checked against the row rather than a posted
 *              field. Without it, an id from somebody else's statement claims their money.
 *   KIND       must be releasable (kinds.ts). An invoice is money owed TO RNL; a receipt
 *              records the past. Neither holds funds, and a claim on one is nonsense.
 *   STATUS     must be ISSUED. A draft was never sent, a PAID one has already been
 *              released, and a VOID one is cancelled.
 *   UNIQUENESS at most one OPEN claim per document - enforced inside
 *              createReleaseRequest's transaction, not here, because here it would race.
 *
 * A failure at any of them redirects with a code rather than throwing: every one of these
 * is reachable from a stale tab, which is the ordinary case, not the attack.
 */
export async function requestFundsAction(formData: FormData) {
  const user = await requirePayUser();
  const id = s(formData, "id");

  const doc = await getDocument(id);
  // The same answer for "no such document" and "not yours" - so this cannot be used to
  // discover which document ids exist.
  if (!doc || doc.partnerAccountId !== user.account.id) {
    redirect("/statements?error=nodoc");
  }
  if (!kindConfig(doc.kind).releasable) {
    redirect("/statements?error=notreleasable");
  }
  if (doc.status !== DocumentStatus.ISSUED) {
    redirect(`/statements?error=${doc.status === DocumentStatus.PAID ? "alreadypaid" : "notopen"}`);
  }

  const result = await createReleaseRequest(doc, {
    partnerAccountId: user.account.id,
    partnerAccountName: user.account.name,
    robloxId: user.robloxId,
    displayName: user.displayName,
  });
  if (!result.ok) redirect("/statements?error=alreadyrequested");

  revalidatePath("/pay/statements");
  revalidatePath("/pay/requests");
  revalidatePath("/pay");
  redirect("/statements?ok=requested");
}

/**
 * Record that this login accepted the payment terms, and let them through.
 *
 * ---- Why the guard is the PRE-TERMS one -----------------------------------
 *
 * Everybody who reaches this action has, by definition, not accepted yet. requirePayUser()
 * would redirect them to the gate they are submitting from, so the acceptance could never
 * be recorded - the one call site where the full guard is the wrong one.
 *
 * It still checks everything else, and it re-checks it HERE rather than trusting the page
 * that rendered the form: access can be revoked between opening the gate and ticking the
 * boxes, and an accepted-terms row for somebody who is no longer a partner is a record of
 * nothing.
 *
 * ---- Why nothing is read off the form -------------------------------------
 *
 * The two checkboxes are confirmed below, and then thrown away. What gets STORED is
 * re-derived from lib/accounting/pay-terms.ts on the server: the version, and a frozen copy
 * of the clauses as this deploy words them. A snapshot posted by the form would be a
 * snapshot the submitter chose, which is worth nothing at all as evidence - the same reason
 * a document's total is computed server-side and never accepted from the builder.
 */
export async function acceptPayTerms(formData: FormData) {
  const user = await requirePayUserPreTerms();

  // Both boxes, or nothing. The form disables its own button until they are ticked, so
  // reaching here unticked means the disable was bypassed - and an acceptance recorded
  // without the assertions is precisely the record that would not stand up.
  const confirmed = PAY_TERMS_CONFIRMATIONS.every(
    (c) => s(formData, c.name) === "on",
  );
  if (!confirmed) redirect("/terms?error=unconfirmed");

  await prisma.partnerAccountMember.update({
    where: { id: user.membership.id },
    data: {
      payTermsAcceptedAt: new Date(),
      payTermsVersion: PAY_TERMS_VERSION,
      payTermsSnapshot: payTermsSnapshot(),
    },
  });

  redirect("/");
}

/** Take back a request nobody has answered yet. Scoped to the caller's own entity. */
export async function withdrawPaymentRequest(formData: FormData) {
  // Same guard as the other two client actions, for the same reason - see the note on
  // submitPaymentRequest.
  const user = await requirePayUser();
  const id = s(formData, "id");

  const done = await withdrawRequest(id, user.account.id);

  revalidatePath("/pay/requests");
  redirect(`/requests?${done ? "ok=withdrawn" : "error=notopen"}`);
}

// ==========================================================================
// The COMPANY's actions - accounts.ronation.live
// ==========================================================================

/**
 * Accept a request, and raise the document it becomes.
 *
 * ---- Why this creates a DRAFT and stops -----------------------------------
 *
 * A PAYMENT becomes a RECEIPT and a REQUEST becomes a CONTRACTOR_PAYMENT, but neither is
 * issued here. Issuing is what mints a number out of the shared sequence and freezes every
 * figure, and doing that straight off a form somebody outside the company filled in would
 * put their arithmetic on RNL's letterhead unread. So: a draft, pre-filled from what they
 * asked for, landing in the editor - where the amount can be corrected, lines added, and
 * the thing actually checked before it becomes a record.
 *
 * The request is marked ACCEPTED in the same act and carries documentId, so the queue can
 * show what it became even if the draft is later discarded (which is why documentId is a
 * plain column and nothing is joined through it - see the schema).
 *
 * ---- The ordering, which is not arbitrary ---------------------------------
 *
 * reviewRequest() runs FIRST and its scoped-to-OPEN update is what serialises two staff
 * clicking Accept at the same moment. The loser gets count 0, is told it was already
 * handled, and - crucially - never reaches createDraft(). Creating the draft first and
 * marking the request second would produce two drafts for one request, one of which
 * nobody is looking at.
 */
export async function acceptPaymentRequest(formData: FormData) {
  const user = await requireCompanyUser();
  const id = s(formData, "id");

  const request = await getRequest(id);
  if (!request) redirect("/requests?error=missing");
  if (request.status !== PaymentRequestStatus.OPEN) {
    redirect("/requests?error=already");
  }

  const isPayment = request.kind === PaymentRequestKind.PAYMENT;
  const cfg = requestKindConfig(request.kind);

  // Claim it before writing anything. See the ordering note above.
  const claimed = await reviewRequest(id, "accepted", user, {
    note: s(formData, "note"),
  });
  if (!claimed) redirect("/requests?error=already");

  // ---- A RELEASE settles a document; it does not create one --------------
  //
  // The money on a payroll slip was described exactly once, at issue, and frozen there.
  // Accepting the payee's claim on it means "yes, we have sent the Robux" - so the right
  // write is markPaid on the document that already exists. Raising a second document here
  // would put the same amount on the books twice, under two numbers, and the ledger would
  // then read as if the contractor were owed it again.
  //
  // markPaid is scoped to ISSUED, so this is a no-op on a document that was paid or voided
  // between the claim and the answer - and that no-op is REPORTED rather than swallowed.
  // "The request is accepted but the document did not move" is precisely the state somebody
  // needs to be told about, because the only thing left to do about it is by hand.
  if (request.kind === PaymentRequestKind.RELEASE && request.againstDocumentId) {
    const settled = await markPaid(request.againstDocumentId);

    // documentId points at the SAME row as againstDocumentId - the document it settled is
    // the document it produced. Written so the queue's "what did this become?" link works
    // for every kind without a branch.
    await recordRequestDocument(id, request.againstDocumentId);

    await audit(
      user,
      AuditAction.ISSUED,
      id,
      `${cfg.staffLabel} from ${request.partnerAccountName}`,
      {
        requestKind: request.kind,
        amount: request.amountRobux,
        documentId: request.againstDocumentId,
        settled,
      },
    );

    revalidatePath("/accounts/requests");
    revalidatePath("/accounts");
    revalidatePath(`/accounts/${request.againstDocumentId}`);
    redirect(
      settled
        ? `/${request.againstDocumentId}?ok=released`
        : "/requests?error=notsettled",
    );
  }

  const draft = await createDraft(
    {
      kind: isPayment ? DocumentKind.RECEIPT : DocumentKind.CONTRACTOR_PAYMENT,
      title: request.reference,
      // The entity's name as it was when they asked, not as it is now - the same snapshot
      // rule the rest of the accounting schema follows.
      counterpartyName: request.partnerAccountName,
      counterpartyRef: request.externalRef,
      counterpartyDetail: null,
      // The scope. This is what lands the finished document back on their own statement,
      // beside the request it came from.
      partnerAccountId: request.partnerAccountId,
      relatedId: null,
      totals: {
        // ONE line, carrying exactly what they asked for. Quantity is 100 centi - one of
        // the thing - so the arithmetic in lines.ts produces the amount unchanged.
        lines: [
          {
            description: request.reference,
            qtyCenti: 100,
            unitRobux: request.amountRobux,
            amountRobux: request.amountRobux,
          },
        ],
        subtotal: request.amountRobux,
        adjustmentRobux: 0,
        total: request.amountRobux,
      },
      adjustmentLabel: null,
      terms: null,
      // Says where the figure came from, on the document itself. Somebody reading this
      // draft in a fortnight needs to know a client typed the amount, not RNL.
      notes: [
        `Raised from a ${cfg.staffLabel.toLowerCase()} submitted by ${request.submittedByName}.`,
        request.detail,
      ]
        .filter(Boolean)
        .join("\n\n"),
      documentDate: request.expectedAt ?? new Date(),
      dueDate: null,
    },
    user,
  );

  // Re-point the request at what it actually became. reviewRequest() has already put it
  // beyond OPEN, so this narrow update is safe to do second - and it must be second,
  // because the draft did not exist when the request was claimed.
  await recordRequestDocument(id, draft.id);

  await audit(
    user,
    AuditAction.CREATED,
    id,
    `${cfg.staffLabel} from ${request.partnerAccountName}`,
    {
      requestKind: request.kind,
      amount: request.amountRobux,
      total: request.amountRobux,
      documentId: draft.id,
      documentKind: draft.kind,
    },
  );

  revalidatePath("/accounts/requests");
  revalidatePath("/accounts");
  // Straight into the draft, not back to the queue. Accepting is the START of the work,
  // and the next thing anybody does is check the figures.
  redirect(`/${draft.id}/edit?ok=fromrequest`);
}

/** Refuse a request. The note is shown to the requester, so it is required. */
export async function declinePaymentRequest(formData: FormData) {
  const user = await requireCompanyUser();
  const id = s(formData, "id");
  const note = s(formData, "note");

  if (!note) redirect(`/requests?error=noreason#${id}`);

  const request = await getRequest(id);
  if (!request) redirect("/requests?error=missing");

  const done = await reviewRequest(id, "declined", user, { note });
  if (!done) redirect("/requests?error=already");

  await audit(
    user,
    AuditAction.REVOKED,
    id,
    `${requestKindConfig(request.kind).staffLabel} from ${request.partnerAccountName}`,
    { requestKind: request.kind, amount: request.amountRobux, note },
  );

  revalidatePath("/accounts/requests");
  revalidatePath("/accounts");
  redirect("/requests?ok=declined");
}

// ---- Bits ----------------------------------------------------------------

/**
 * Write the raised document's id onto the request.
 *
 * Its own function, and not folded into reviewRequest(), because the two happen at
 * different moments: the request is claimed BEFORE the draft exists (see the ordering note
 * on acceptPaymentRequest) and this is the second half. Scoped to ACCEPTED so it cannot
 * attach a document to a request that was declined in between.
 */
async function recordRequestDocument(id: string, documentId: string) {
  const { prisma } = await import("@/lib/db");
  await prisma.paymentRequest.updateMany({
    where: { id, status: PaymentRequestStatus.ACCEPTED },
    data: { documentId },
  });
}

/** One audit line, in the company scope. Same shape as the document actions'. */
function audit(
  user: CompanyUser,
  action: AuditAction,
  id: string,
  name: string,
  meta: Record<string, unknown>,
) {
  const verb: Partial<Record<AuditAction, string>> = {
    [AuditAction.CREATED]: "accepted",
    [AuditAction.REVOKED]: "declined",
  };

  return recordAudit({
    scope: COMPANY_SCOPE,
    action,
    target: AuditTarget.PAYMENT_REQUEST,
    targetId: id,
    targetName: name,
    actor: { id: user.robloxId, name: user.displayName, kind: AuditActorKind.COMPANY },
    summary: `${user.displayName} ${verb[action] ?? "changed"} ${name}${
      typeof meta.amount === "number" ? ` (${formatRobux(meta.amount)})` : ""
    }`,
    meta: meta as Prisma.InputJsonValue,
  });
}

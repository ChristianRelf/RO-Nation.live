"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { DocumentKind, PaymentRequestKind, PaymentRequestStatus } from "@prisma/client";
import { requireCompanyUser, type CompanyUser } from "@/lib/company";
import { requirePartnerAccount } from "@/lib/partner-account";
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
  createRequest,
  getRequest,
  reviewRequest,
  withdrawRequest,
} from "@/lib/accounting/requests";
import {
  parseRequestKind,
  requestKindConfig,
} from "@/lib/accounting/request-kinds";
import { createDraft } from "@/lib/accounting/documents";

// Every act on a payment request. TWO audiences write here, which is why the guard on
// each action is worth reading before changing one.
//
//   requirePartnerAccount()   the client, on pay.ronation.live. May CREATE a request and
//                             WITHDRAW their own. Nothing else - see below.
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
  const user = await requirePartnerAccount();

  const kind = parseRequestKind(s(formData, "kind"));
  if (!kind) return { error: "Unknown request type." };

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

/** Take back a request nobody has answered yet. Scoped to the caller's own entity. */
export async function withdrawPaymentRequest(formData: FormData) {
  const user = await requirePartnerAccount();
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

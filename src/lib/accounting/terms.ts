import { DocumentKind } from "@prisma/client";
import { site } from "../site";

// The block of terms that prints at the foot of every accounting sheet RNL issues.
//
// ---- Why this exists at all -----------------------------------------------
//
// A document from this desk used to end in one sentence of small print. That sentence was
// accurate, and it was nowhere near enough: it never said that issuing the paper does not
// move any Robux, that the amount is HELD until the payee asks for it, where they ask, what
// happens if the details are wrong, or what actually constitutes the payment being
// complete. Every one of those is a conversation somebody has had to have on Discord, weeks
// after the fact, with a person holding a document that told them none of it.
//
// So the sheet now carries the whole thing. It is long on purpose - this is the paper a
// contractor keeps, and the questions it answers are the ones they will have when nobody
// from RNL is available to answer them.
//
// ---- Why it is DERIVED per kind, and not one string -----------------------
//
// The five kinds do not make the same promise, and a single block of terms stapled to all
// of them would be wrong on at least three:
//
//   INVOICE          money flows TOWARDS RNL. "The amount payable by RO. Nation LIVE" is
//                    exactly backwards, and would be a written admission of a debt RNL
//                    does not owe.
//   RECEIPT          records the past. It has no payment to request, no portal to visit,
//                    and telling somebody to go and claim a payment they have already made
//                    is how a receipt turns into a support ticket.
//   TICKET_REFUND    outbound, and NOT releasable - see the note on that field in kinds.ts.
//                    Its payee is a ticket holder with no partner account and nothing to
//                    sign into. Pointing them at pay.ronation.live sends a member of the
//                    public to a login screen that will never let them in.
//
// The two kinds that genuinely hold money (CONTRACTOR_PAYMENT, CREDIT_NOTE) get the full
// held-pending-request wording, because for them every clause of it is true.
//
// PURE - no prisma, no env, no server-only - like kinds.ts and lines.ts beside it, so the
// same words can be asserted in a test without standing a database up.

/** The reading address of the client side. Derived, so a move is one edit in site.ts. */
export const PAY_DOMAIN = `pay.${site.domain}`;

/** The reading address of the contact form, for the payees who have no portal account. */
export const CONTACT_PATH = `${site.domain}/contact`;

/**
 * Where the full policy behind these clauses lives.
 *
 * Printed on every sheet, because a term somebody can only read on the paper it is
 * printed on is a term they cannot check. This block is the short version; /legal/payments
 * is the whole thing, and the two are edited together.
 */
export const TERMS_PATH = `${site.domain}/legal/payments`;

/**
 * One label/value pair in the strip under the clauses - the portal, the currency, the
 * issuer. Repeated deliberately from the prose above it: they are the three things
 * somebody scans for when they come back to the document a month later, and a fact that
 * only exists in the middle of a paragraph is a fact nobody finds twice.
 */
export type TermsFact = { label: string; value: string };

export type PaymentTerms = {
  /** The heading on paper. Uppercased in CSS, so it is written in sentence case here. */
  heading: string;
  /**
   * The clauses, in order, one per paragraph.
   *
   * `**bold**` is honoured by the renderer (see components/accounting/terms-block.tsx) and
   * nothing else is. The emphasis is not decoration: it marks the handful of phrases that
   * change what somebody DOES - "does not constitute payment", "held pending a valid
   * payment request" - and those are the phrases a person skimming needs to hit.
   */
  clauses: string[];
  facts: TermsFact[];
};

const ISSUER: TermsFact = { label: "Issuer", value: site.name };
const CURRENCY: TermsFact = { label: "Currency", value: "Robux (R$)" };
const PORTAL: TermsFact = { label: "Payment portal", value: PAY_DOMAIN };
const ENQUIRIES: TermsFact = { label: "Enquiries", value: CONTACT_PATH };
const FULL_TERMS: TermsFact = { label: "Full terms", value: TERMS_PATH };

/**
 * Clauses shared by every sheet, whichever way the money runs.
 *
 * Written as a function of the noun ("document", "statement") so the payout statement can
 * borrow them without describing itself as a document - it is a different instrument, and
 * calling it one on its own paper invites the reader to look for a number it does not have.
 */
function commonClauses(noun: string): string[] {
  return [
    `Unless otherwise stated on this ${noun}, payment is made in **Robux (R$)** only. The amount shown represents the total Robux payable and should not be interpreted as a cash value, a monetary balance, or a guarantee of conversion into real-world currency.`,
    `If the information contained on this ${noun} appears to be incorrect, duplicated, disputed, or issued in error, the recipient should contact ${site.name} before submitting a payment request. ${site.name} reserves the right to correct, cancel, amend, or invalidate ${noun}s issued in error, or where the underlying payment obligation is no longer valid.`,
  ];
}

/**
 * The full held-pending-request terms - the ones for a sheet that OWES somebody money and
 * puts a claim button on their statement.
 *
 * This is the wording that matters most in the whole system. Issuing one of these creates
 * an obligation and moves nothing, and the gap between those two facts is where every
 * "where is my payout?" comes from.
 */
function heldTerms(noun: string): string[] {
  return [
    `This ${noun} confirms the amount payable by **${site.name}**, stated in Robux (R$), and identifies the goods, services, reimbursement, award, or other payment to which the amount relates. This ${noun} is provided for record and payment-request purposes only.`,
    `The issue of this ${noun} **does not constitute payment** and does not automatically transfer, send, or otherwise release the stated Robux amount to the recipient. No Robux will be sent solely as a result of this ${noun} being issued.`,
    `The amount stated on this ${noun} will be **held pending a valid payment request** from the intended recipient. To request payment, the recipient must sign in at **${PAY_DOMAIN}** and submit a payment request referencing the details shown on this ${noun}.`,
    `The recipient is responsible for ensuring that all information submitted when requesting payment is accurate and corresponds with the details shown on this ${noun}. ${site.name} may request additional information or verification where reasonably necessary before releasing funds.`,
    `Submission of a payment request does not guarantee immediate payment. Requests may be reviewed before funds are released, and payment may be delayed where information is incomplete, inaccurate, disputed, or requires verification.`,
    ...commonClauses(noun),
    `This ${noun} does not by itself confirm that payment has been completed. **Only a confirmed payment through the designated payment system constitutes completion of the payment obligation.**`,
    `By requesting payment, the recipient confirms that they are the intended recipient of the stated amount and that the information provided in the payment request is accurate and complete.`,
  ];
}

const HELD: PaymentTerms = {
  heading: "Payment terms & conditions",
  clauses: heldTerms("document"),
  facts: [PORTAL, CURRENCY, ISSUER, FULL_TERMS],
};

/**
 * An invoice runs the other way: somebody owes RNL.
 *
 * Every "payable by RO. Nation LIVE" is inverted, and the portal is described for what it
 * actually does on this side of the ledger - it does not take a payment, it records that
 * one was sent, so it can be matched and receipted. Saying "pay at pay.ronation.live"
 * would describe a checkout that does not exist; the Robux moves through Roblox.
 */
const INVOICE_TERMS: PaymentTerms = {
  heading: "Payment terms & conditions",
  clauses: [
    `This document states an amount payable **to ${site.name}**, in Robux (R$), and identifies the goods, services, or other supply to which the amount relates. It is a request for payment and a record of the obligation.`,
    `Payment is due by the date shown on this document, or on receipt where no date is stated. The amount remains outstanding until the Robux is received by ${site.name}.`,
    `Payment is made in **Robux (R$)** through Roblox - a group payout or a direct transfer. **No payment is taken on this document**, and no ${site.name} website can take Robux from you. Please quote the document number shown above so the payment can be matched.`,
    `Once the Robux has been sent, tell us at **${PAY_DOMAIN}**. That does not move any Robux either; it records that a payment is coming, so it can be matched against this document and receipted back to you.`,
    `**Only Robux actually received constitutes payment.** Notifying us of a payment, on this or any other channel, does not settle this document. It is settled when the Robux arrives and a numbered receipt is issued against it.`,
    ...commonClauses("document"),
    `Where an amount remains unpaid, ${site.name} may suspend further supply, withhold services, or set the amount off against any sum otherwise payable to the recipient.`,
  ],
  facts: [PORTAL, CURRENCY, ISSUER, FULL_TERMS],
};

/**
 * A receipt records the past, so most of the block above is meaningless on it. What it
 * needs to say instead is what it proves, what it settles, and that no further action is
 * expected - a receipt that ends in "to request payment, sign in at..." reads as a bill.
 */
const RECEIPT_TERMS: PaymentTerms = {
  heading: "Receipt terms & conditions",
  clauses: [
    `This document confirms that the amount stated was **received by ${site.name}** in Robux (R$), and identifies the goods, services, or other supply to which it relates.`,
    `It is a record of a completed payment. **No further action is required from the recipient** in respect of the amount shown, and no additional sum becomes payable as a result of this document being issued.`,
    `Where this receipt is issued against another document, that document is settled to the extent of the amount shown here. Any balance remaining on it stays payable under its own terms.`,
    `Amounts are stated in **Robux (R$)** and should not be interpreted as a cash value, a monetary balance, or a guarantee of conversion into real-world currency.`,
    `If the information on this receipt appears to be incorrect, duplicated, or issued in error, contact ${site.name}. ${site.name} reserves the right to correct, cancel, amend, or invalidate documents issued in error. Please retain this document for your records.`,
  ],
  facts: [CURRENCY, ISSUER, ENQUIRIES, FULL_TERMS],
};

/**
 * A ticket refund is outbound and is NOT claimed through the portal - its payee is a member
 * of the public with no account there. So the block keeps the "issuing this is not payment"
 * spine of HELD and replaces the claim route with the one that is actually open to them:
 * talking to a person. See the note on `releasable` in kinds.ts.
 */
const REFUND_TERMS: PaymentTerms = {
  heading: "Refund terms & conditions",
  clauses: [
    `This document confirms a refund authorised by **${site.name}**, stated in Robux (R$), and identifies the ticket to which it relates. It is a record of that authorisation and a request for the payment to be made.`,
    `The issue of this document **does not constitute payment** and does not automatically transfer, send, or otherwise release the stated Robux amount. No Robux will be sent solely as a result of this document being issued.`,
    `The original purchase was made **through Roblox** and cannot be reversed there by ${site.name}. This amount is paid separately, by Roblox group payout, to the Roblox account named above.`,
    `**No account or sign-in is needed to receive this refund**, and you will never be asked to sign in to a payment portal to claim it. If you have any question about this document, contact ${site.name} at ${CONTACT_PATH}. Anybody asking you to sign in elsewhere, or to send Robux in order to receive it, is not us.`,
    `Tickets are ordinarily **non-refundable**. This authorisation is exceptional, applies only to the ticket identified above, and does not create any entitlement to a refund on any other ticket or future purchase.`,
    ...commonClauses("document"),
    `**Only Robux actually received constitutes payment.** This document records that a refund has been authorised, not that it has been sent.`,
  ],
  facts: [CURRENCY, ISSUER, ENQUIRIES, FULL_TERMS],
};

const TERMS_BY_KIND: Record<DocumentKind, PaymentTerms> = {
  [DocumentKind.INVOICE]: INVOICE_TERMS,
  [DocumentKind.CONTRACTOR_PAYMENT]: HELD,
  [DocumentKind.RECEIPT]: RECEIPT_TERMS,
  [DocumentKind.CREDIT_NOTE]: HELD,
  [DocumentKind.TICKET_REFUND]: REFUND_TERMS,
};

/** The terms block for one document kind. Total - every kind has one. */
export function documentTerms(kind: DocumentKind): PaymentTerms {
  return TERMS_BY_KIND[kind];
}

/**
 * The terms for a PAYOUT STATEMENT - the other instrument this codebase prints
 * (components/portal/payout-invoice.tsx).
 *
 * Two variants, matching that component's own split:
 *
 *   partner  RNL owes the partner their share. Same spine as HELD, because the same thing
 *            is true of it: the statement is arithmetic, not a transfer, and the partner
 *            asks for the money at pay.ronation.live.
 *   self     RNL's own shows. There is no payee and nothing to claim, so a block telling
 *            "the recipient" how to request payment would be RNL writing to itself. It
 *            gets a short statement-of-record block instead.
 */
export function payoutStatementTerms(variant: "partner" | "self"): PaymentTerms {
  if (variant === "self") {
    return {
      heading: "Statement terms",
      clauses: [
        `This statement sets out ticket revenue recorded for ${site.name}'s own events over the period shown. It is an internal record for reconciliation, and identifies no external payee.`,
        `All ticket revenue is collected by ${site.name}. Roblox deducts its platform fee at the point of sale; the balance is ${site.name}'s own revenue. **No platform fee is taken from any third party** on the events listed here.`,
        `Every figure is counted from the payment ledger at the moment this statement was generated. It is **not a payment instruction**, and issuing it neither transfers nor releases any Robux.`,
        `Amounts are stated in **Robux (R$)** and should not be interpreted as a cash value, a monetary balance, or a guarantee of conversion into real-world currency.`,
      ],
      facts: [CURRENCY, ISSUER, FULL_TERMS],
    };
  }

  return {
    heading: "Payment terms & conditions",
    clauses: [
      `This statement sets out the ticket revenue recorded for the events listed, the deductions applied to it, and the resulting amount payable by **${site.name}** in Robux (R$). It is provided for reconciliation and payment-request purposes only.`,
      `All ticket revenue is collected by ${site.name}. Roblox deducts its platform fee at the point of sale; ${site.name} retains its platform fee on the amount received; the balance is payable to the organiser. The stack is shown in full above.`,
      `The issue of this statement **does not constitute payment** and does not automatically transfer, send, or otherwise release the stated Robux amount. No Robux will be sent solely as a result of this statement being issued.`,
      `The amount stated will be **held pending a valid payment request** from the intended recipient. To request payment, the recipient must sign in at **${PAY_DOMAIN}** and submit a payment request quoting the statement number shown above.`,
      `Submission of a payment request does not guarantee immediate payment. Requests may be reviewed before funds are released, and payment may be delayed where information is incomplete, inaccurate, disputed, or requires verification.`,
      ...commonClauses("statement"),
      `This statement does not by itself confirm that payment has been completed. **Only a confirmed payment through the designated payment system constitutes completion of the payment obligation.**`,
      `By requesting payment, the recipient confirms that they are the intended recipient of the stated amount and that the information provided in the payment request is accurate and complete.`,
    ],
    facts: [PORTAL, CURRENCY, ISSUER, FULL_TERMS],
  };
}

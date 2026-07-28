import { PaymentRequestKind, PaymentRequestStatus } from "@prisma/client";
import type { StatusTone } from "./kinds";

// What separates the two kinds of payment request - and, as with document kinds, it is
// almost entirely WORDING.
//
// The shape of both is identical (an entity, an amount, a reference, a status), which is
// why they share one table. What differs is the heading somebody reads, which way the
// Robux moves, and what the request becomes if it is agreed.
//
// ---- Why this is a separate module from requests.ts -----------------------
//
// requests.ts is `server-only`: it holds the Prisma reads and writes, and importing it
// from a client component is a build error by design. But the request FORM is a client
// component and needs these labels, and the status badge is rendered from both sides of
// the desk. So the wording lives here, in a PURE module with no database access - exactly
// the split kinds.ts already makes against documents.ts, and for exactly the reason that
// file gives: two copies of this table is how a form comes to say "when did you send it"
// over a date the other side reads as "when do you need it by".

export type RequestKindConfig = {
  kind: PaymentRequestKind;
  /** What the requester calls it. */
  label: string;
  /** What STAFF call it - the same row, read from the other side of the desk. */
  staffLabel: string;
  /** Which way the Robux moves, from RNL's point of view. */
  direction: "inbound" | "outbound";
  /** The heading on the form. */
  formTitle: string;
  /** One paragraph under it, saying what submitting actually does. */
  formBlurb: string;
  /** The label over the amount field. */
  amountLabel: string;
  /** The label over the free-text reference. */
  referenceLabel: string;
  /** The label over their own reference - a transaction id, their invoice number. */
  externalRefLabel: string;
  /** The label over the date. */
  dateLabel: string;
  /** What the submit button says. */
  submitLabel: string;
};

const REQUEST_CONFIG: Record<PaymentRequestKind, RequestKindConfig> = {
  [PaymentRequestKind.PAYMENT]: {
    kind: PaymentRequestKind.PAYMENT,
    label: "Payment to RO. Nation LIVE",
    staffLabel: "Incoming payment",
    direction: "inbound",
    formTitle: "Tell us about a payment",
    // Says what it is NOT, first. A form headed "make a payment" that does not move any
    // money is a form people submit and then sit waiting on, and the misunderstanding
    // only surfaces a fortnight later when nobody has been paid.
    formBlurb:
      "This does not move any Robux. Robux is sent through Roblox — a group payout or a direct transfer — and no form here can do that for you. What this does is tell RO. Nation LIVE the money is coming, so it can be matched against what you owe and receipted back to you.",
    amountLabel: "How much are you sending?",
    referenceLabel: "What is it for?",
    externalRefLabel: "Your reference",
    dateLabel: "When did you send it (or when will you)?",
    submitLabel: "Tell us about this payment",
  },
  [PaymentRequestKind.REQUEST]: {
    kind: PaymentRequestKind.REQUEST,
    label: "Payment from RO. Nation LIVE",
    staffLabel: "Payout request",
    direction: "outbound",
    formTitle: "Request a payment",
    formBlurb:
      "Ask RO. Nation LIVE for money — a payout you are expecting, work delivered, an expense. Somebody reads every one of these. If it is agreed you get a numbered payroll slip on your statement, and the Robux follows by group payout.",
    amountLabel: "How much are you asking for?",
    referenceLabel: "What is it for?",
    externalRefLabel: "Your reference",
    dateLabel: "When do you need it by?",
    submitLabel: "Send this request",
  },
};

export function requestKindConfig(kind: PaymentRequestKind): RequestKindConfig {
  return REQUEST_CONFIG[kind];
}

export const REQUEST_KINDS: RequestKindConfig[] = [
  REQUEST_CONFIG[PaymentRequestKind.PAYMENT],
  REQUEST_CONFIG[PaymentRequestKind.REQUEST],
];

/** Resolve a kind from an untrusted string. Null rather than a default - see parseKind. */
export function parseRequestKind(
  v: string | null | undefined,
): PaymentRequestKind | null {
  if (!v) return null;
  const upper = v.toUpperCase();
  return upper in REQUEST_CONFIG ? (upper as PaymentRequestKind) : null;
}

/**
 * The four request states share the document badge's tone vocabulary.
 *
 * Aliased rather than re-declared so the two badges cannot drift into meaning different
 * things by "warning" - and re-exported from here so a component reading REQUEST_STATUS_META
 * does not also have to reach into kinds.ts for the type of one of its fields.
 */
export type RequestStatusTone = StatusTone;

export const REQUEST_STATUS_META: Record<
  PaymentRequestStatus,
  { label: string; tone: RequestStatusTone; hint: string }
> = {
  [PaymentRequestStatus.OPEN]: {
    label: "Open",
    tone: "warning",
    hint: "Submitted. Nobody has answered it yet — you can still withdraw it.",
  },
  [PaymentRequestStatus.ACCEPTED]: {
    label: "Accepted",
    tone: "positive",
    hint: "Agreed, and a numbered document has been raised from it.",
  },
  [PaymentRequestStatus.DECLINED]: {
    label: "Declined",
    tone: "danger",
    hint: "Not agreed. The note says why.",
  },
  [PaymentRequestStatus.WITHDRAWN]: {
    label: "Withdrawn",
    tone: "neutral",
    hint: "You took this one back before it was answered.",
  },
};

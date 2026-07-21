import { DocumentKind, DocumentStatus } from "@prisma/client";

// What separates the four document kinds - and it is almost entirely WORDING.
//
// The shape of all four is identical (a payee, some lines, a total, frozen at issue),
// which is why they share one table. What differs is the heading a person reads, which
// way the money flows, and what the number looks like. That belongs here, as data, not
// as branches scattered through pages: adding a fifth kind should be one entry in this
// file plus one enum value, and nothing else.
//
// This module is PURE - no prisma client calls, no server-only import - because the
// document builder is a client component and needs the same labels the printed page
// uses. Two copies of this table is how a form comes to say "Bill to" over a document
// that prints "Payable to".

/** Which way the money moves, from RNL's point of view. */
export type MoneyDirection =
  /** Somebody owes RNL. An invoice we send out. */
  | "inbound"
  /** RNL owes somebody. A contractor payment. */
  | "outbound";

export type KindConfig = {
  kind: DocumentKind;
  /** Menu and list wording. */
  label: string;
  plural: string;
  /** The big word at the top of the printed page. */
  heading: string;
  /** The three letters in the document number: RNL-INV-2026-0007. */
  numberSegment: string;
  direction: MoneyDirection;
  /** The heading over the counterparty block on the paper. */
  partyLabel: string;
  /** The heading over the counterparty field in the builder form. */
  partyFieldLabel: string;
  /** The label on the bottom-line total. */
  totalLabel: string;
  /** One sentence under the picker, saying when to reach for this one. */
  hint: string;
  /** The small print at the foot of the printed document. */
  smallPrint: string;
  /** Does a due date make sense? A receipt records the past and has none. */
  hasDueDate: boolean;
  /**
   * May this kind point at another document? A receipt settles an invoice and a credit
   * note corrects one; an invoice and a payment stand alone.
   */
  relates: false | { label: string; hint: string };
  /** Default terms text offered in the builder. The author can always overwrite it. */
  defaultTerms: string;
};

const CONFIG: Record<DocumentKind, KindConfig> = {
  [DocumentKind.INVOICE]: {
    kind: DocumentKind.INVOICE,
    label: "Invoice",
    plural: "Invoices",
    heading: "Invoice",
    numberSegment: "INV",
    direction: "inbound",
    partyLabel: "Bill to",
    partyFieldLabel: "Who is being billed",
    totalLabel: "Amount due",
    hint: "Bill someone for something the ticket ledger doesn't know about - a sponsorship, a booking fee, a service.",
    smallPrint:
      "Payable to RO. Nation LIVE in Robux (R$). Please quote the document number when paying.",
    hasDueDate: true,
    relates: false,
    defaultTerms: "Due on receipt.",
  },

  [DocumentKind.CONTRACTOR_PAYMENT]: {
    kind: DocumentKind.CONTRACTOR_PAYMENT,
    label: "Contractor payment",
    plural: "Contractor payments",
    // Not "invoice": this is the document RNL raises for money it is PAYING, which in
    // real books is a payment advice / remittance, never an invoice. Calling it one
    // would put the wrong word on a page a contractor keeps for their own records.
    heading: "Payment advice",
    numberSegment: "PAY",
    direction: "outbound",
    partyLabel: "Payable to",
    partyFieldLabel: "Who is being paid",
    totalLabel: "Amount payable",
    hint: "Pay a builder, artist, dev or other contractor. Rate x hours or a fixed fee, with what the work was.",
    smallPrint:
      "Payable by RO. Nation LIVE in Robux (R$). This advice confirms the amount and what it covers; it is not a receipt.",
    hasDueDate: true,
    relates: false,
    defaultTerms: "Paid on issue, via Roblox group payout.",
  },

  [DocumentKind.RECEIPT]: {
    kind: DocumentKind.RECEIPT,
    label: "Receipt",
    plural: "Receipts",
    heading: "Receipt",
    numberSegment: "RCT",
    direction: "inbound",
    partyLabel: "Received from",
    partyFieldLabel: "Who paid",
    totalLabel: "Amount received",
    hint: "Record that money actually moved. Point it at an invoice or a payment to settle that document too.",
    smallPrint:
      "This receipt confirms the amount above was received in Robux (R$). Retain for your records.",
    hasDueDate: false,
    relates: {
      label: "Receipt for",
      hint: "Issuing this will also mark the chosen document as paid.",
    },
    defaultTerms: "",
  },

  [DocumentKind.CREDIT_NOTE]: {
    kind: DocumentKind.CREDIT_NOTE,
    label: "Credit note",
    plural: "Credit notes",
    heading: "Credit note",
    numberSegment: "CRN",
    direction: "outbound",
    partyLabel: "Credit to",
    partyFieldLabel: "Who is being credited",
    totalLabel: "Total credited",
    hint: "Correct or refund a document already issued. An issued document is never edited - this is how it is put right.",
    smallPrint:
      "This credit note reduces the amount owed on the document referenced above by the total shown, in Robux (R$).",
    hasDueDate: false,
    relates: {
      label: "Credit against",
      hint: "The issued document this corrects. It stays on the record; this note is the correction.",
    },
    defaultTerms: "",
  },

  [DocumentKind.TICKET_REFUND]: {
    kind: DocumentKind.TICKET_REFUND,
    label: "Ticket refund",
    plural: "Ticket refunds",
    heading: "Refund",
    numberSegment: "REF",
    direction: "outbound",
    partyLabel: "Refund to",
    partyFieldLabel: "Ticket holder",
    totalLabel: "Amount refunded",
    hint: "Money back to a ticket holder. Written against the ticket and capped at what they actually paid. Exceptional cases only.",
    // Says plainly what the document can and cannot do. A Robux purchase is a Roblox
    // transaction and CANNOT be reversed from here - see lib/accounting/refunds.ts. The
    // document authorises and records a payout; a human still has to send the Robux.
    smallPrint:
      "Refund authorised by RO. Nation LIVE in Robux (R$). The original purchase was made through Roblox and cannot be reversed there; this amount is paid separately. Tickets are ordinarily non-refundable — this is an exceptional authorisation.",
    hasDueDate: false,
    relates: false,
    defaultTerms: "Paid separately via Roblox group payout.",
  },
};

/**
 * The kinds that are WRITTEN BY HAND in the generic builder, in the order offered.
 *
 * TICKET_REFUND is deliberately absent: its lines are derived from a ticket and capped
 * at what that ticket was paid, so it has its own guarded route (/company/accounting/
 * refund) and must never be reachable through the free-form builder. Listing it here
 * would offer a way to type any amount against any name.
 */
export const DOCUMENT_KINDS: KindConfig[] = [
  CONFIG[DocumentKind.INVOICE],
  CONFIG[DocumentKind.CONTRACTOR_PAYMENT],
  CONFIG[DocumentKind.RECEIPT],
  CONFIG[DocumentKind.CREDIT_NOTE],
];

/** Every kind, including the ones with their own routes - for filters and labels. */
export const ALL_DOCUMENT_KINDS: KindConfig[] = [
  ...DOCUMENT_KINDS,
  CONFIG[DocumentKind.TICKET_REFUND],
];

/**
 * Is this kind written through the generic builder?
 *
 * The guard behind the builder routes AND behind editing: a refund draft opened in the
 * free-form editor could have its amount raised past what the holder ever paid.
 */
export function isHandAuthored(kind: DocumentKind): boolean {
  return kind !== DocumentKind.TICKET_REFUND;
}

export function kindConfig(kind: DocumentKind): KindConfig {
  return CONFIG[kind];
}

/**
 * Resolve a kind from an untrusted string - a `?kind=` query, a posted field.
 *
 * Returns null rather than a default, so a caller has to decide what a bad value means.
 * Defaulting silently would let a typo'd query string mint the wrong kind of document.
 */
export function parseKind(v: string | null | undefined): DocumentKind | null {
  if (!v) return null;
  const upper = v.toUpperCase();
  return upper in CONFIG ? (upper as DocumentKind) : null;
}

// ---- Status presentation -------------------------------------------------

export type StatusTone = "neutral" | "positive" | "warning" | "danger";

export const STATUS_META: Record<
  DocumentStatus,
  { label: string; tone: StatusTone; hint: string }
> = {
  [DocumentStatus.DRAFT]: {
    label: "Draft",
    tone: "neutral",
    hint: "Not issued. Editable, unnumbered, and nobody outside the company can see it.",
  },
  [DocumentStatus.ISSUED]: {
    label: "Issued",
    tone: "warning",
    hint: "Frozen and numbered. Readable on its share link.",
  },
  [DocumentStatus.PAID]: {
    label: "Paid",
    tone: "positive",
    hint: "Settled.",
  },
  [DocumentStatus.VOID]: {
    label: "Void",
    tone: "danger",
    hint: "Cancelled. Kept on the record - the number is never reused.",
  },
};

/** Is this document still editable? Exactly one status says yes. */
export function isEditable(status: DocumentStatus): boolean {
  return status === DocumentStatus.DRAFT;
}

/**
 * Does this document count toward money owed / owing?
 *
 * Drafts are not promises and voids are cancelled promises; neither belongs in a total
 * on the dashboard. Only ISSUED is outstanding, and only PAID is settled.
 */
export function isOutstanding(status: DocumentStatus): boolean {
  return status === DocumentStatus.ISSUED;
}

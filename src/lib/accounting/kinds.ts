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
  /**
   * The word in the document's own URL:
   * accounts.ronation.live/document/<slug>/<token>.
   *
   * It is NOT derived from `kind` (CONTRACTOR_PAYMENT would read badly), from `heading`
   * (which is prose and gets reworded - "Payment advice" became "Payroll slip" without
   * a single link needing to change) or from `numberSegment` (three letters nobody can
   * read). It is its own field precisely so those three can move and these cannot: a
   * document URL is sent to somebody outside the company and then lives in their inbox
   * forever.
   *
   * Lowercase, hyphenated, and unique across CONFIG - documentKindBySlug() below relies
   * on that, and there is a test asserting it.
   */
  slug: string;
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
  /**
   * The small print at the foot of the printed document, ONE STRING PER PARAGRAPH.
   *
   * It was a single string, and a single string is what kept this line honest by accident:
   * there was only room for one thing, so it said the one thing, and everything else a
   * payee needed to know was not said anywhere. The full terms now live in terms.ts and
   * print above this; what is left here is the kind-specific line - the sentence that is
   * true of a payslip and false of a receipt - and it is a list because two short
   * paragraphs are read and one long one is not.
   */
  smallPrint: string[];
  /** Does a due date make sense? A receipt records the past and has none. */
  hasDueDate: boolean;
  /**
   * Does issuing this HOLD money that the other side then has to ask for?
   *
   * ---- The rule this encodes -----------------------------------------------
   *
   * Issuing an outbound document does not move any Robux. It never did - a human always
   * had to make the group payout by hand - but the paper used to imply otherwise ("Paid on
   * issue"), and there was no way for a payee to say "I would like this now". So the
   * amount on an issued payroll slip sat in a state nobody had a name for: owed, not sent,
   * with the payee's only recourse being to chase somebody on Discord.
   *
   * Now it has a name. ISSUED means HELD; the payee raises a RELEASE request from their
   * statement; accepting it marks the document PAID. No new document is created, because
   * the money was already described exactly once, at issue.
   *
   * ---- Why this is a flag and not `direction === "outbound"` ---------------
   *
   * TICKET_REFUND is outbound and is NOT releasable. A refund is exceptional by design -
   * the desk that writes one is deliberately friction-heavy - and its payee is a ticket
   * holder, who has no partner account, no statement, and nowhere to press a button. A
   * derived rule would sweep it in and quietly put a self-service claim on the one
   * document in the system that is meant to be hard.
   */
  releasable: boolean;
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
    slug: "invoice",
    numberSegment: "INV",
    direction: "inbound",
    partyLabel: "Bill to",
    partyFieldLabel: "Who is being billed",
    totalLabel: "Amount due",
    hint: "Bill someone for something the ticket ledger doesn't know about - a sponsorship, a booking fee, a service.",
    smallPrint: [
      "Payable to RO. Nation LIVE in Robux (R$). Please quote the document number when paying.",
      "Robux is sent through Roblox, not through this document or any RO. Nation LIVE website. Once it is on its way, tell us at pay.ronation.live so it can be matched and receipted.",
    ],
    hasDueDate: true,
    releasable: false,
    relates: false,
    defaultTerms: "Due on receipt.",
  },

  [DocumentKind.CONTRACTOR_PAYMENT]: {
    kind: DocumentKind.CONTRACTOR_PAYMENT,
    label: "Contractor payment",
    plural: "Contractor payments",
    // Not "invoice": this is the document RNL raises for money it is PAYING, and calling
    // it an invoice would put the wrong word on a page a contractor keeps for their own
    // records. "Payroll slip" is RNL's own name for it - the nearest standard-books term
    // is a payment advice or remittance, which is what it behaves like.
    //
    // Sentence case, like "Credit note" and unlike the title-cased name it is sometimes
    // written as in conversation: the string appears mid-sentence in the partner's
    // document list, and DocumentPaper uppercases it in CSS for the printed heading.
    heading: "Payroll slip",
    // "payslip", not "payroll-slip" or "contractor-payment": it is the word a contractor
    // would say, and the one they will recognise in the link they were sent.
    slug: "payslip",
    numberSegment: "PAY",
    direction: "outbound",
    partyLabel: "Payable to",
    partyFieldLabel: "Who is being paid",
    totalLabel: "Amount payable",
    hint: "Pay a builder, artist, dev or other contractor. Rate x hours or a fixed fee, with what the work was.",
    // Says the thing the old wording got wrong. It used to read "this slip confirms the
    // amount and what it covers; it is not a receipt", which is true and incomplete: it
    // left the reader to assume the Robux was on its way. It is not. It is HELD until they
    // ask for it, and the sentence that matters is the one telling them they have to.
    smallPrint: [
      "This slip confirms the amount above and what it covers. It is not a receipt, and issuing it does not send the Robux — the amount is held until you request it.",
      "Sign in at pay.ronation.live and request the funds on this document. It is released by Roblox group payout once somebody has actioned it, and this slip is marked paid at that point.",
    ],
    hasDueDate: true,
    releasable: true,
    relates: false,
    // Was "Paid on issue, via Roblox group payout." - which was simply not true, and was
    // the line a contractor would quote back at you a fortnight later.
    defaultTerms: "Held until requested. Released by Roblox group payout once you ask for it.",
  },

  [DocumentKind.RECEIPT]: {
    kind: DocumentKind.RECEIPT,
    label: "Receipt",
    plural: "Receipts",
    heading: "Receipt",
    slug: "receipt",
    numberSegment: "RCT",
    direction: "inbound",
    partyLabel: "Received from",
    partyFieldLabel: "Who paid",
    totalLabel: "Amount received",
    hint: "Record that money actually moved. Point it at an invoice or a payment to settle that document too.",
    smallPrint: [
      "This receipt confirms the amount above was received in Robux (R$). Retain for your records.",
      "Nothing further is owed on it. If it settles another document, that document is marked paid to the extent of the amount shown here.",
    ],
    hasDueDate: false,
    releasable: false,
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
    slug: "credit-note",
    numberSegment: "CRN",
    direction: "outbound",
    partyLabel: "Credit to",
    partyFieldLabel: "Who is being credited",
    totalLabel: "Total credited",
    hint: "Correct or refund a document already issued. An issued document is never edited - this is how it is put right.",
    smallPrint: [
      "This credit note reduces the amount owed on the document referenced above by the total shown, in Robux (R$).",
      "If you have already settled that document, the credit can be paid back out instead — request the funds on this note at pay.ronation.live. Issuing it does not send the Robux; the amount is held until you ask.",
    ],
    hasDueDate: false,
    // A credit ordinarily just cancels what is owed, and needs no payout at all. But when
    // the document it corrects was ALREADY PAID, the credit is money that has to come back
    // - and that case is invisible to everyone except the person who paid it. So they get
    // the same button, and staff decline it when the credit is simply being offset.
    releasable: true,
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
    slug: "refund",
    numberSegment: "REF",
    direction: "outbound",
    partyLabel: "Refund to",
    partyFieldLabel: "Ticket holder",
    totalLabel: "Amount refunded",
    hint: "Money back to a ticket holder. Written against the ticket and capped at what they actually paid. Exceptional cases only.",
    // Says plainly what the document can and cannot do. A Robux purchase is a Roblox
    // transaction and CANNOT be reversed from here - see lib/accounting/refunds.ts. The
    // document authorises and records a payout; a human still has to send the Robux.
    smallPrint: [
      "Refund authorised by RO. Nation LIVE in Robux (R$). The original purchase was made through Roblox and cannot be reversed there; this amount is paid separately, by group payout.",
      "Tickets are ordinarily non-refundable — this is an exceptional authorisation, and it covers only the ticket named above. You do not need to sign in anywhere to receive it.",
    ],
    hasDueDate: false,
    // Outbound, and still not releasable - see the note on the field. Its payee is a ticket
    // holder with no partner account and no statement to press a button on, and the refund
    // desk is meant to stay a deliberate act by a person rather than a queue.
    releasable: false,
    relates: false,
    defaultTerms: "Paid separately via Roblox group payout.",
  },
};

/**
 * The kinds that are WRITTEN BY HAND in the generic builder, in the order offered.
 *
 * TICKET_REFUND is deliberately absent: its lines are derived from a ticket and capped
 * at what that ticket was paid, so it has its own guarded route
 * (accounts.ronation.live/refund) and must never be reachable through the free-form
 * builder. Listing it here would offer a way to type any amount against any name.
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

/** Every config, in enum order. For the slug lookup and for tests that sweep all kinds. */
export const EVERY_KIND_CONFIG: KindConfig[] = Object.values(CONFIG);

/**
 * Resolve the `<slug>` in accounts.ronation.live/document/<slug>/<token>.
 *
 * Returns null for anything unrecognised, like parseKind above and for the same reason:
 * the caller decides what a bad value means. The document route 404s on it, which is the
 * only sane answer - a slug that does not name a kind cannot name a document either.
 *
 * IMPORTANT: matching the slug is not enough on its own. The route must ALSO check that
 * the document the token resolved to is actually of this kind - see the note in
 * app/document/[kind]/[token]/page.tsx. The token is the authorization; the slug is a
 * claim about what it points at, and a URL that lies about which document you are reading
 * is worse than one that 404s.
 */
export function documentKindBySlug(
  slug: string | null | undefined,
): DocumentKind | null {
  if (!slug) return null;
  const lower = slug.toLowerCase();
  return EVERY_KIND_CONFIG.find((c) => c.slug === lower)?.kind ?? null;
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

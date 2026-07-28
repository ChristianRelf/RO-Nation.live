import "server-only";
import { randomBytes } from "crypto";
import type { AccountingDocument, Prisma } from "@prisma/client";
import { DocumentKind, DocumentStatus } from "@prisma/client";
import { prisma } from "../db";
import { kindConfig } from "./kinds";
import type { DocumentTotals } from "./lines";

// The only writer of accounting_documents.
//
// Two rules live in here rather than in the pages, because a rule enforced by a page is
// a rule enforced by whichever page remembered:
//
//   1. FREEZE. A document is editable while DRAFT and never again. Every mutating
//      function below re-reads the row and checks its status itself - it does not
//      believe the caller's claim about what state the document was in when the form
//      was rendered. A stale tab is the ordinary case, not the attack.
//
//   2. NUMBERS AND TOKENS ARE MINTED AT ISSUE, once. Not at creation: a discarded draft
//      must not burn a number out of the sequence. Not again on a re-issue: the number
//      on a document somebody has already been sent is not ours to change.

/**
 * The share-token alphabet - lowercase and digits, minus the pairs that get misread
 * when a link is copied off a screen or read down a call: 0/o, 1/l/i.
 */
const TOKEN_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * 40 characters, because that is the length the document URL is specified at:
 * accounts.ronation.live/document/<kind>/<40 chars>.
 *
 * It was 24, and 24 was already past sufficient - ~118 bits, more than a session id. So
 * the widening buys no security worth naming; what it buys is a URL shape that is FIXED,
 * checkable at a glance, and the same on every document RNL has ever sent. That is worth
 * having on a link that lives in somebody else's inbox for years.
 *
 * Tokens minted before this are 24 characters and STILL RESOLVE. Lookup is an exact match
 * on the column (getDocumentByToken), so a document already sent keeps working - there is
 * no length check anywhere, deliberately, and the schema note says so too. Rotating a
 * document's link mints a 40 under the new rules.
 */
const TOKEN_LENGTH = 40;

/**
 * A share token: ~198 bits over the alphabet above.
 *
 * This is a bearer capability - whoever holds the link reads the document - so it has
 * to be unguessable in the same way a session id is, not merely "long". Two bytes per
 * character then modulo, exactly as lib/apikey.ts does and for the reason documented
 * there: one byte modulo 31 skews the early letters, because 31 does not divide 256.
 */
function mintToken(): string {
  const bytes = randomBytes(TOKEN_LENGTH * 2);
  let out = "";
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    out +=
      TOKEN_ALPHABET[((bytes[i * 2] << 8) | bytes[i * 2 + 1]) % TOKEN_ALPHABET.length];
  }
  return out;
}

/** Everything a draft is written from. Totals arrive already computed - see lines.ts. */
export type DocumentInput = {
  kind: DocumentKind;
  title: string;
  counterpartyName: string;
  counterpartyRef?: string | null;
  counterpartyDetail?: string | null;
  /**
   * Set when the counterparty above is a PartnerAccount the staff picked, rather than free
   * text - the id of that entity. It does not print (counterpartyName already carries the
   * name); it is the scope key behind the partner's /partner accounting tab. Null otherwise.
   */
  partnerAccountId?: string | null;
  relatedId?: string | null;
  totals: DocumentTotals;
  adjustmentLabel?: string | null;
  terms?: string | null;
  notes?: string | null;
  documentDate: Date;
  dueDate?: Date | null;
};

/**
 * The extra couple of fields a TICKET_REFUND carries.
 *
 * Separate from DocumentInput, and only accepted by createDraft, because updateDraft
 * must not be able to move them: re-pointing an existing refund at a different ticket
 * would slip past the "never more than they paid" ceiling, which is checked against the
 * ticket at the moment of writing. A refund is written once and then only issued,
 * voided, or discarded.
 */
export type RefundBinding = {
  ticketId: string;
  voidsTicket: boolean;
};

/** The fields a draft write sets - everything except `kind`, which is fixed at creation. */
export type DocumentFields = Omit<DocumentInput, "kind">;

function writeData(input: DocumentFields) {
  return {
    title: input.title,
    counterpartyName: input.counterpartyName,
    counterpartyRef: input.counterpartyRef || null,
    counterpartyDetail: input.counterpartyDetail || null,
    partnerAccountId: input.partnerAccountId || null,
    relatedId: input.relatedId || null,
    // Cast through unknown for the same reason lib/invoices.ts does: a named type has no
    // index signature, and InputJsonValue wants one. The value is already valid JSON.
    lineItems: input.totals.lines as unknown as Prisma.InputJsonValue,
    subtotal: input.totals.subtotal,
    adjustmentRobux: input.totals.adjustmentRobux,
    adjustmentLabel: input.adjustmentLabel || null,
    total: input.totals.total,
    terms: input.terms || null,
    notes: input.notes || null,
    documentDate: input.documentDate,
    dueDate: input.dueDate ?? null,
  };
}

/** Start a draft. Unnumbered, unshared, editable - nothing is promised yet. */
export function createDraft(
  input: DocumentInput,
  by: { robloxId: string; displayName: string },
  refund?: RefundBinding,
): Promise<AccountingDocument> {
  return prisma.accountingDocument.create({
    data: {
      kind: input.kind,
      ...writeData(input),
      ...(refund
        ? { ticketId: refund.ticketId, voidsTicket: refund.voidsTicket }
        : {}),
      createdByRobloxId: by.robloxId,
      createdByName: by.displayName,
    },
  });
}

/**
 * Rewrite a draft.
 *
 * `updateMany` scoped to `status: DRAFT` rather than a read-then-write: the status check
 * and the write are then one statement, so an issue landing between them cannot be
 * overwritten. A count of 0 means it was not a draft any more, and the caller says so.
 */
export async function updateDraft(
  id: string,
  input: DocumentFields,
): Promise<boolean> {
  const { count } = await prisma.accountingDocument.updateMany({
    where: { id, status: DocumentStatus.DRAFT },
    // `kind` is absent by type: what a document IS gets chosen once, at creation. An
    // edit that could change it would change the number it is about to be given.
    data: writeData(input),
  });
  return count === 1;
}

/** Discard a draft. Only ever a draft - an issued document is history and stays. */
export async function deleteDraft(id: string): Promise<boolean> {
  const { count } = await prisma.accountingDocument.deleteMany({
    where: { id, status: DocumentStatus.DRAFT },
  });
  return count === 1;
}

export type IssueResult =
  | { ok: true; document: AccountingDocument }
  | { ok: false; reason: "missing" | "already" };

/**
 * Freeze a draft: give it its number and its share link, and stop it being editable.
 *
 * All of it in ONE transaction, because the number comes from a shared counter. Two
 * people issuing at the same instant must not be handed the same number, and
 * `count() + 1` would do exactly that - both read the same count before either writes.
 * The upsert-with-increment below compiles to an atomic INSERT … ON CONFLICT DO UPDATE,
 * so Postgres serialises the pair on the counter row and the second gets the next value.
 *
 * A RECEIPT also settles what it points at, in the same transaction: recording that
 * money arrived and leaving the invoice reading "issued" is how books go wrong.
 */
export async function issueDocument(
  id: string,
  by: { robloxId: string; displayName: string },
): Promise<IssueResult> {
  try {
    const document = await prisma.$transaction(async (tx) => {
      const existing = await tx.accountingDocument.findUnique({ where: { id } });
      if (!existing) throw new IssueError("missing");
      if (existing.status !== DocumentStatus.DRAFT) throw new IssueError("already");

      // The year of the DOCUMENT's own date, not today's - a January payroll slip
      // dated to December's work belongs in December's sequence.
      const year = existing.documentDate.getFullYear();
      const counter = await tx.documentCounter.upsert({
        where: { kind_year: { kind: existing.kind, year } },
        create: { kind: existing.kind, year, seq: 1 },
        update: { seq: { increment: 1 } },
      });

      const segment = kindConfig(existing.kind).numberSegment;
      const number = `RNL-${segment}-${year}-${String(counter.seq).padStart(4, "0")}`;

      const issued = await tx.accountingDocument.update({
        where: { id },
        data: {
          status: DocumentStatus.ISSUED,
          number,
          shareToken: mintToken(),
          issuedAt: new Date(),
          issuedByRobloxId: by.robloxId,
          issuedByName: by.displayName,
        },
      });

      // Only from ISSUED: a receipt against a draft would settle something that was
      // never sent, and one against a void document would resurrect it.
      if (issued.kind === DocumentKind.RECEIPT && issued.relatedId) {
        await tx.accountingDocument.updateMany({
          where: { id: issued.relatedId, status: DocumentStatus.ISSUED },
          data: { status: DocumentStatus.PAID, paidAt: new Date() },
        });
      }

      return issued;
    });

    return { ok: true, document };
  } catch (err) {
    if (err instanceof IssueError) return { ok: false, reason: err.reason };
    throw err;
  }
}

class IssueError extends Error {
  constructor(public reason: "missing" | "already") {
    super(reason);
  }
}

/**
 * Mark an issued document settled.
 *
 * Scoped to ISSUED, so it is a no-op on a draft (nothing was owed yet), on an already
 * paid document (idempotent - paidAt never moves) and on a void one.
 */
export async function markPaid(id: string): Promise<boolean> {
  const { count } = await prisma.accountingDocument.updateMany({
    where: { id, status: DocumentStatus.ISSUED },
    data: { status: DocumentStatus.PAID, paidAt: new Date() },
  });
  return count === 1;
}

/**
 * Cancel a document.
 *
 * From ISSUED or PAID, never from DRAFT - a draft is discarded, not voided, and a void
 * unissued document would be a number-less entry in the cancelled column. The row and
 * its number survive: voiding is a correction on the record, not a deletion.
 */
export async function voidDocument(id: string, reason: string): Promise<boolean> {
  const { count } = await prisma.accountingDocument.updateMany({
    where: { id, status: { in: [DocumentStatus.ISSUED, DocumentStatus.PAID] } },
    data: {
      status: DocumentStatus.VOID,
      voidedAt: new Date(),
      voidReason: reason.slice(0, 500) || null,
    },
  });
  return count === 1;
}

/**
 * Mint a fresh share token, killing the old link.
 *
 * The only way to un-share a document that went to the wrong address. It changes
 * nothing about the document itself - the number, the figures and the issue date are
 * still frozen - which is why this is allowed on an issued document at all.
 */
export async function rotateShareToken(id: string): Promise<string | null> {
  const { count } = await prisma.accountingDocument.updateMany({
    where: { id, status: { not: DocumentStatus.DRAFT } },
    data: { shareToken: mintToken(), firstViewedAt: null, viewCount: 0 },
  });
  if (count !== 1) return null;
  const row = await prisma.accountingDocument.findUnique({
    where: { id },
    select: { shareToken: true },
  });
  return row?.shareToken ?? null;
}

// ---- Reads ---------------------------------------------------------------

export function getDocument(id: string): Promise<AccountingDocument | null> {
  return prisma.accountingDocument.findUnique({ where: { id } });
}

/**
 * Resolve a share link.
 *
 * DRAFT is excluded in the WHERE, not filtered after: an unissued document has no token
 * at all today, and scoping it here means it stays unreachable even if some future path
 * mints one early.
 */
export function getDocumentByToken(
  token: string,
): Promise<AccountingDocument | null> {
  if (!token) return Promise.resolve(null);
  return prisma.accountingDocument.findFirst({
    where: { shareToken: token, status: { not: DocumentStatus.DRAFT } },
  });
}

/**
 * Note that a share link was opened. Never throws - failing to count a view must not
 * turn reading a document into an error page, exactly as markInvoiceOpened has it.
 */
export async function recordShareView(id: string): Promise<void> {
  try {
    await Promise.all([
      prisma.accountingDocument.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      }),
      // `firstViewedAt: null` in the WHERE makes this a no-op on every view after the
      // first, so the timestamp records when they first opened it and never moves -
      // the same trick markInvoiceOpened() uses, and for the same reason.
      prisma.accountingDocument.updateMany({
        where: { id, firstViewedAt: null },
        data: { firstViewedAt: new Date() },
      }),
    ]);
  } catch (err) {
    console.error("recordShareView failed", err);
  }
}

export type DocumentFilter = {
  kind?: DocumentKind;
  status?: DocumentStatus;
};

/** The list, newest first. Capped - the desk is a list to work from, not an archive. */
export function listDocuments(
  filter: DocumentFilter = {},
  take = 200,
): Promise<AccountingDocument[]> {
  return prisma.accountingDocument.findMany({
    where: {
      ...(filter.kind ? { kind: filter.kind } : {}),
      ...(filter.status ? { status: filter.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/**
 * Every issued document raised against one partner entity, newest first - the list behind their
 * /partner accounting tab. DRAFT is excluded in the WHERE, not filtered after: a draft the
 * company has not issued is not the partner's to see, the same gate the partner invoice reads
 * put on SENT. Scoped to partnerAccountId, which is indexed for exactly this read.
 */
export function listDocumentsForPartnerAccount(
  partnerAccountId: string,
): Promise<AccountingDocument[]> {
  if (!partnerAccountId) return Promise.resolve([]);
  return prisma.accountingDocument.findMany({
    where: { partnerAccountId, status: { not: DocumentStatus.DRAFT } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Issued documents another one may point at - the picker on a receipt or credit note.
 *
 * Only ISSUED: a draft is not yet a thing to receipt, and a paid or void one is
 * already settled. Excludes `self` so a document cannot be made to reference itself.
 */
export function listRelatable(self?: string): Promise<AccountingDocument[]> {
  return prisma.accountingDocument.findMany({
    where: {
      status: DocumentStatus.ISSUED,
      kind: { in: [DocumentKind.INVOICE, DocumentKind.CONTRACTOR_PAYMENT] },
      ...(self ? { id: { not: self } } : {}),
    },
    orderBy: { issuedAt: "desc" },
    take: 100,
  });
}

export type PartnerLedger = {
  /** Issued and unsettled, RNL → them. Money they are waiting on. */
  dueToPartner: number;
  /** Issued and unsettled, them → RNL, net of credit notes. Money they owe. */
  dueFromPartner: number;
  /** Settled RNL → them this calendar year. What they have actually been paid. */
  paidToPartnerYtd: number;
  /** How many documents are still ISSUED - the count behind the two figures above. */
  outstandingCount: number;
};

/**
 * The same ledger as accountingSummary(), turned around to face the PARTNER.
 *
 * Pure, over rows the caller already holds, rather than a groupBy: the overview page
 * lists a partner's recent documents anyway, and a second round trip to re-sum the
 * dozen rows it just fetched would buy nothing. accountingSummary() aggregates in the
 * database for the opposite reason - it sums the whole desk, which grows without bound.
 *
 * The kinds are spelled out rather than read off KindConfig.direction, and that is not
 * an oversight. A CREDIT_NOTE is "outbound" from RNL's side - money it will not now be
 * receiving - but no Robux moves toward the partner: it CANCELS what they owe. Folding
 * it into dueToPartner on the strength of its direction would tell a partner they were
 * owed a payout that is never coming.
 *
 * Feed it the list from listDocumentsForPartnerAccount(): DRAFT is already excluded
 * there, and VOID falls out below by matching neither status.
 */
export function partnerLedger(docs: AccountingDocument[]): PartnerLedger {
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const toPartner: DocumentKind[] = [
    DocumentKind.CONTRACTOR_PAYMENT,
    DocumentKind.TICKET_REFUND,
  ];

  const ledger: PartnerLedger = {
    dueToPartner: 0,
    dueFromPartner: 0,
    paidToPartnerYtd: 0,
    outstandingCount: 0,
  };

  for (const doc of docs) {
    if (doc.status === DocumentStatus.ISSUED) {
      ledger.outstandingCount += 1;
      if (toPartner.includes(doc.kind)) ledger.dueToPartner += doc.total;
      else if (doc.kind === DocumentKind.INVOICE) ledger.dueFromPartner += doc.total;
      else if (doc.kind === DocumentKind.CREDIT_NOTE)
        ledger.dueFromPartner -= doc.total;
    } else if (
      doc.status === DocumentStatus.PAID &&
      toPartner.includes(doc.kind) &&
      doc.paidAt &&
      doc.paidAt >= yearStart
    ) {
      ledger.paidToPartnerYtd += doc.total;
    }
  }

  return ledger;
}

// ---- The books -----------------------------------------------------------

export type BooksRow = {
  /** 0-11. The calendar month, not a fiscal one - RNL has no fiscal year to speak of. */
  month: number;
  /** Billed out: invoices raised. */
  invoiced: number;
  /** Actually received: receipts. */
  received: number;
  /** Actually paid out: payroll slips and ticket refunds. */
  paidOut: number;
  /** Cancelled off what was billed: credit notes. */
  credited: number;
  /** How many documents sit behind the four figures above. */
  count: number;
};

export type Books = {
  year: number;
  /** Twelve rows, always - a month with nothing in it is a zero row, not a gap. */
  months: BooksRow[];
  totals: Omit<BooksRow, "month">;
  /** Every year that actually has documents in it, newest first. The year picker. */
  years: number[];
};

/** An empty month. Named, because the reduce below needs twelve of them and a total. */
function emptyBooksRow(month: number): BooksRow {
  return { month, invoiced: 0, received: 0, paidOut: 0, credited: 0, count: 0 };
}

/**
 * The books for one calendar year, by month.
 *
 * ---- What counts, and what does not ---------------------------------------
 *
 * DRAFT and VOID are excluded. A draft is not a transaction - it is something somebody
 * started typing - and a void is a cancelled one. Including either would mean the books
 * moved when a person opened a form, or when a mistake was corrected, which is the
 * opposite of what a set of books is for. This is the same rule isOutstanding() states
 * for the dashboard figures, applied over a period instead of a moment.
 *
 * ISSUED and PAID both count, and they count the same. The distinction between "billed"
 * and "settled" is what the DESK is for (owedToUs, owedByUs on the summary); the books
 * answer a different question - what was written, in which month - and answering it two
 * ways on two pages is how two people come to quote different figures at each other.
 *
 * Bucketed by documentDate, NOT by issuedAt. A payroll slip written in January for
 * December's work is dated to December and belongs in December, which is exactly the same
 * call issueDocument() makes when it takes the number out of December's sequence.
 *
 * ---- Why this reads rows rather than grouping in the database -------------
 *
 * accountingSummary() groups in Postgres because it sums the WHOLE table, which grows
 * without bound. This is bounded by construction: one year of one small company's
 * documents, four integer fields each. Prisma cannot express date_trunc in groupBy, so the
 * alternative is raw SQL, and raw SQL for a bounded read is a maintenance cost with
 * nothing bought.
 */
export async function books(year: number): Promise<Books> {
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1);

  const [rows, all] = await Promise.all([
    prisma.accountingDocument.findMany({
      where: {
        status: { in: [DocumentStatus.ISSUED, DocumentStatus.PAID] },
        documentDate: { gte: from, lt: to },
      },
      select: { kind: true, total: true, documentDate: true },
    }),
    // Every year with something in it, for the picker. `distinct` on a date column would
    // give distinct DATES, so the years are derived here - it is a handful of rows.
    prisma.accountingDocument.findMany({
      where: { status: { in: [DocumentStatus.ISSUED, DocumentStatus.PAID] } },
      select: { documentDate: true },
    }),
  ]);

  const months = Array.from({ length: 12 }, (_, i) => emptyBooksRow(i));
  const totals = emptyBooksRow(-1);

  for (const row of rows) {
    const bucket = months[row.documentDate.getMonth()];
    // Both the month and the year total, in one pass. Two loops would be two places for
    // a new kind to be forgotten.
    for (const target of [bucket, totals]) {
      target.count += 1;
      if (row.kind === DocumentKind.INVOICE) target.invoiced += row.total;
      else if (row.kind === DocumentKind.RECEIPT) target.received += row.total;
      else if (row.kind === DocumentKind.CREDIT_NOTE) target.credited += row.total;
      else target.paidOut += row.total;
    }
  }

  const years = [...new Set(all.map((r) => r.documentDate.getFullYear()))].sort(
    (a, b) => b - a,
  );
  // The current year is always offered, even before anything has been written in it -
  // otherwise the first document of January is filed from a page you cannot open.
  const thisYear = new Date().getFullYear();
  if (!years.includes(thisYear)) years.unshift(thisYear);
  if (!years.includes(year)) years.push(year);

  const { month: _drop, ...totalFields } = totals;
  return { year, months, totals: totalFields, years: years.sort((a, b) => b - a) };
}

export type AccountingSummary = {
  /** Issued and unsettled, by direction. */
  owedToUs: number;
  owedByUs: number;
  /** Settled this calendar year, by direction. */
  receivedYtd: number;
  paidYtd: number;
  /** Refunds settled this year - a subset of paidYtd, surfaced because it is watched. */
  refundedYtd: number;
  draftCount: number;
};

/**
 * The figures on the hub.
 *
 * Grouped in the DATABASE rather than by pulling rows and reducing: these are sums over
 * the whole table, and the one thing a summary must not do is get slower as the desk
 * fills up. Drafts and voids are excluded from every money figure - see isOutstanding().
 */
export async function accountingSummary(): Promise<AccountingSummary> {
  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  const [outstanding, settled, draftCount] = await Promise.all([
    prisma.accountingDocument.groupBy({
      by: ["kind"],
      where: { status: DocumentStatus.ISSUED },
      _sum: { total: true },
    }),
    prisma.accountingDocument.groupBy({
      by: ["kind"],
      where: { status: DocumentStatus.PAID, paidAt: { gte: yearStart } },
      _sum: { total: true },
    }),
    prisma.accountingDocument.count({ where: { status: DocumentStatus.DRAFT } }),
  ]);

  const sumWhere = (
    rows: { kind: DocumentKind; _sum: { total: number | null } }[],
    kinds: DocumentKind[],
  ) =>
    rows
      .filter((r) => kinds.includes(r.kind))
      .reduce((n, r) => n + (r._sum.total ?? 0), 0);

  // A credit note reduces what is owed, so it sits on the opposite side of the ledger
  // from the invoice it corrects - money we will not now be receiving.
  // An authorised refund is money RNL owes a ticket holder and has not yet sent, so it
  // belongs beside contractor payments in "owed by us" - not in a column of its own and
  // certainly not netted off revenue, which would hide it.
  return {
    owedToUs:
      sumWhere(outstanding, [DocumentKind.INVOICE]) -
      sumWhere(outstanding, [DocumentKind.CREDIT_NOTE]),
    owedByUs: sumWhere(outstanding, [
      DocumentKind.CONTRACTOR_PAYMENT,
      DocumentKind.TICKET_REFUND,
    ]),
    receivedYtd: sumWhere(settled, [DocumentKind.RECEIPT]),
    paidYtd: sumWhere(settled, [
      DocumentKind.CONTRACTOR_PAYMENT,
      DocumentKind.TICKET_REFUND,
    ]),
    refundedYtd: sumWhere(settled, [DocumentKind.TICKET_REFUND]),
    draftCount,
  };
}

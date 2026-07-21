import "server-only";
import type { Invoice, Prisma } from "@prisma/client";
import { InvoiceStatus } from "@prisma/client";
import { prisma } from "./db";
import { getSettlement, type Settlement, type SettlementRange } from "./settlement";
import { partnerBySlug } from "./partners/registry";

// The read/write layer for payout invoices. The company mints them here from a live
// settlement, freezing every figure at that moment (see the Invoice model note); the
// partner only ever reads the ones sent to them, reconstructed back into a Settlement so
// the same PayoutInvoice renders both. Nothing outside this module writes the table.

/** One frozen line on an invoice - a SettlementRow with its Date flattened to ISO for JSON. */
export type InvoiceLineItem = {
  eventId: string;
  title: string;
  /** ISO string. Rehydrated to a Date by settlementFromInvoice(). */
  startsAt: string;
  payments: number;
  robux: number;
};

/**
 * Generate a DRAFT invoice for a partner over a period.
 *
 * Snapshots the settlement as it stands right now - the gross, the whole fee stack and
 * every per-show line - into the row. It does NOT send it: issuing and sending are two
 * deliberate acts (see sendInvoice), so a mistaken generation can be discarded before the
 * partner ever sees it.
 *
 * Returns null when `partnerSlug` names no partner - the caller has already guarded the
 * door, so this only fires on a bad slug, and a bad slug is a 404 there, not a throw here.
 */
export async function createInvoice(opts: {
  partnerSlug: string;
  periodTag: string;
  periodLabel: string;
  range?: SettlementRange;
  issuedBy: { robloxId: string; displayName: string };
}): Promise<Invoice | null> {
  const partner = partnerBySlug(opts.partnerSlug);
  if (!partner) return null;

  // The slug, never null: a partner spells its eventScope the same as its slug, and this
  // path is partners-only (RNL's own revenue has no payee to invoice).
  const settlement = await getSettlement(partner.slug, opts.range);

  const lineItems: InvoiceLineItem[] = settlement.shows.map((s) => ({
    eventId: s.eventId,
    title: s.title,
    startsAt: s.startsAt.toISOString(),
    payments: s.payments,
    robux: s.robux,
  }));

  return prisma.invoice.create({
    data: {
      partnerId: partner.slug,
      number: `RNL-${partner.slug.toUpperCase()}-${opts.periodTag}`,
      payeeName: partner.name,
      periodTag: opts.periodTag,
      periodLabel: opts.periodLabel,
      gross: settlement.payout.gross,
      robloxFee: settlement.payout.robloxFee,
      afterRoblox: settlement.payout.afterRoblox,
      rnlFee: settlement.payout.rnlFee,
      partnerPayout: settlement.payout.partnerPayout,
      capped: settlement.capped,
      // Prisma's Json column takes the array straight; it is read back the same shape.
      // Cast through unknown because a named interface lacks the implicit index signature
      // InputJsonValue wants - the runtime value is already valid JSON.
      lineItems: lineItems as unknown as Prisma.InputJsonValue,
      issuedByRobloxId: opts.issuedBy.robloxId,
      issuedByName: opts.issuedBy.displayName,
    },
  });
}

/**
 * Send a draft to the partner: flip it to SENT and stamp when.
 *
 * Idempotent on the status - re-sending an already-sent invoice does not move sentAt, so
 * a double click or a stale page cannot rewrite the day it was issued. Returns the row, or
 * null if the id is unknown.
 */
export async function sendInvoice(id: string): Promise<Invoice | null> {
  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing) return null;
  if (existing.status === InvoiceStatus.SENT) return existing;

  return prisma.invoice.update({
    where: { id },
    data: { status: InvoiceStatus.SENT, sentAt: new Date() },
  });
}

/** Every invoice for the company index, newest first. */
export function listAllInvoices(): Promise<Invoice[]> {
  return prisma.invoice.findMany({ orderBy: { issuedAt: "desc" } });
}

/** One partner's invoices - all statuses - for the company per-partner page. */
export function listInvoicesForPartner(partnerSlug: string): Promise<Invoice[]> {
  return prisma.invoice.findMany({
    where: { partnerId: partnerSlug },
    orderBy: { issuedAt: "desc" },
  });
}

/** A single invoice for the COMPANY view - any status, since the company sees drafts. */
export function getInvoiceForCompany(
  partnerSlug: string,
  id: string,
): Promise<Invoice | null> {
  // Matched on partnerId too, so an id pasted under the wrong partner's URL resolves to
  // nothing rather than rendering another partner's document under this one's heading.
  return prisma.invoice.findFirst({ where: { id, partnerId: partnerSlug } });
}

/** A partner's SENT invoices, for the list on their payouts page. Drafts never leak. */
export function listSentInvoicesForPartner(
  partnerSlug: string,
): Promise<Invoice[]> {
  return prisma.invoice.findMany({
    where: { partnerId: partnerSlug, status: InvoiceStatus.SENT },
    orderBy: { issuedAt: "desc" },
  });
}

/**
 * A single SENT invoice for the PARTNER view.
 *
 * Scoped to the partner AND to SENT: a draft the company has not sent, or an id belonging
 * to another partner, both resolve to null - a partner can only ever open what has actually
 * been issued to them.
 */
export function getSentInvoiceForPartner(
  partnerSlug: string,
  id: string,
): Promise<Invoice | null> {
  return prisma.invoice.findFirst({
    where: { id, partnerId: partnerSlug, status: InvoiceStatus.SENT },
  });
}

/**
 * Mark a sent invoice as opened by the partner, the first time they open it.
 *
 * This is the "notification" turning off: openedAt is what the payouts-page indicator
 * counts, so stamping it here is what makes a new invoice stop reading as new. updateMany
 * with `openedAt: null` in the WHERE makes it a no-op on every subsequent open - the FIRST
 * view wins and the timestamp never moves. Never throws: failing to clear a badge must not
 * turn viewing a document into an error.
 */
export async function markInvoiceOpened(id: string): Promise<void> {
  try {
    await prisma.invoice.updateMany({
      where: { id, status: InvoiceStatus.SENT, openedAt: null },
      data: { openedAt: new Date() },
    });
  } catch (err) {
    console.error("markInvoiceOpened failed", err);
  }
}

/** How many sent invoices this partner has not opened yet - the payouts-page badge count. */
export function unopenedInvoiceCount(partnerSlug: string): Promise<number> {
  return prisma.invoice.count({
    where: { partnerId: partnerSlug, status: InvoiceStatus.SENT, openedAt: null },
  });
}

/**
 * Rebuild a Settlement from a frozen invoice, so the same PayoutInvoice component renders
 * a stored document exactly as it renders a live one.
 *
 * Only the fields PayoutInvoice actually reads are reconstructed faithfully - the fee
 * stack, the per-show rows and `capped`; totalRobux/totalPayments are filled from the
 * snapshot for completeness but the document does not depend on them.
 */
export function settlementFromInvoice(inv: Invoice): Settlement {
  const items = (inv.lineItems as unknown as InvoiceLineItem[]) ?? [];
  const shows = items.map((i) => ({
    eventId: i.eventId,
    title: i.title,
    startsAt: new Date(i.startsAt),
    payments: i.payments,
    robux: i.robux,
  }));

  return {
    totalRobux: inv.gross,
    totalPayments: shows.reduce((n, s) => n + s.payments, 0),
    shows,
    payout: {
      gross: inv.gross,
      robloxFee: inv.robloxFee,
      afterRoblox: inv.afterRoblox,
      rnlFee: inv.rnlFee,
      partnerPayout: inv.partnerPayout,
    },
    capped: inv.capped,
  };
}

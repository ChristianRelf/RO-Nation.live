import { describe, it, expect, beforeEach } from "vitest";
import { DocumentKind, DocumentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  checkRefundAmount,
  lookupTicketForRefund,
  refundedSoFar,
} from "@/lib/accounting/refunds";
import { resetDb, makeUser, makeEvent } from "./helpers";

// The two guards on refunding a ticket (lib/accounting/refunds.ts).
//
// A refund is the only document on the accounting desk that pays real money OUT against
// a record we already hold, which makes it the only one where a wrong number is a
// transfer rather than a piece of paper. Both guards are asserted against the database
// rather than the form, because the form is not what enforces them:
//
//   1. NEVER MORE THAN THEY PAID. The ceiling is the TicketPurchase ledger - what
//      Roblox reported taking - not the tier's list price. A comped ticket on a 500 R$
//      tier was paid 0 and must refund 0, and the difference between those two numbers
//      is the whole test.
//
//   2. NEVER TWICE. Issued refunds come off the ceiling. Without this, two crew members
//      working the same complaint each see "500 refundable" and pay out 1,000.
//
// The status filter in guard 2 gets its own tests, because it is wrong in both
// directions: counting DRAFTs blocks real refunds behind abandoned ones, and counting
// VOIDs permanently eats headroom that was never paid out.

async function makeTicket(opts: { paid?: number[]; status?: "RESERVED" | "CHECKED_IN" | "CANCELLED" } = {}) {
  const user = await makeUser();
  const event = await makeEvent();
  const ticket = await prisma.ticket.create({
    data: {
      code: `RN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      eventId: event.id,
      userId: user.id,
      status: opts.status ?? "RESERVED",
      tierName: "VIP",
      priceRobux: 500,
    },
  });

  for (const [i, robuxSpent] of (opts.paid ?? []).entries()) {
    await prisma.ticketPurchase.create({
      data: { purchaseId: `${ticket.id}-${i}`, ticketId: ticket.id, robuxSpent },
    });
  }
  return { ticket, user, event };
}

async function makeRefund(ticketId: string, total: number, status: DocumentStatus) {
  return prisma.accountingDocument.create({
    data: {
      kind: DocumentKind.TICKET_REFUND,
      status,
      ticketId,
      title: "Refund",
      counterpartyName: "Holder",
      lineItems: [],
      subtotal: total,
      total,
      documentDate: new Date(),
      createdByRobloxId: "1",
      createdByName: "Tester",
      ...(status === DocumentStatus.ISSUED || status === DocumentStatus.PAID
        ? { number: `RNL-REF-2026-${Math.floor(Math.random() * 1e6)}`, issuedAt: new Date() }
        : {}),
    },
  });
}

beforeEach(async () => {
  await prisma.accountingDocument.deleteMany();
  await resetDb();
});

describe("lookupTicketForRefund", () => {
  it("sums the purchase ledger, not the tier price", async () => {
    // The tier says 500. They actually paid 300 (a presale price, a discount, whatever
    // the ledger says). 300 is the ceiling; believing priceRobux would refund 200 R$ of
    // money that was never taken.
    const { ticket } = await makeTicket({ paid: [300] });
    const target = await lookupTicketForRefund(ticket.code);

    expect(target).not.toBeNull();
    expect(target!.paid).toBe(300);
    expect(target!.refundable).toBe(300);
  });

  it("adds up multiple payments, because an upgrade is a second one", async () => {
    const { ticket } = await makeTicket({ paid: [200, 150] });
    const target = await lookupTicketForRefund(ticket.code);
    expect(target!.paid).toBe(350);
    expect(target!.payments).toBe(2);
  });

  it("reports a comped ticket as paid nothing", async () => {
    const { ticket } = await makeTicket({ paid: [] });
    const target = await lookupTicketForRefund(ticket.code);
    expect(target!.paid).toBe(0);
    expect(target!.refundable).toBe(0);
  });

  it("finds a ticket by code case-insensitively, and by id", async () => {
    // The code is what crew actually paste out of a DM, and it arrives in whatever case
    // the holder typed it.
    const { ticket } = await makeTicket({ paid: [100] });
    expect((await lookupTicketForRefund(ticket.code.toLowerCase()))?.ticketId).toBe(
      ticket.id,
    );
    expect((await lookupTicketForRefund(`  ${ticket.code}  `))?.ticketId).toBe(ticket.id);
    expect((await lookupTicketForRefund(ticket.id))?.ticketId).toBe(ticket.id);
  });

  it("returns null for an unknown code rather than throwing", async () => {
    expect(await lookupTicketForRefund("RN-NOPE00")).toBeNull();
    expect(await lookupTicketForRefund("")).toBeNull();
  });

  it("says a checked-in ticket cannot be voided, but can still be refunded", async () => {
    // voidTicket() refuses CHECKED_IN - they are already inside the room. The refund is
    // still perfectly writable; it just cannot take a ticket back that was used.
    const { ticket } = await makeTicket({ paid: [400], status: "CHECKED_IN" });
    const target = await lookupTicketForRefund(ticket.code);
    expect(target!.canVoid).toBe(false);
    expect(target!.refundable).toBe(400);
  });

  it("says an already-cancelled ticket has nothing left to void", async () => {
    const { ticket } = await makeTicket({ paid: [400], status: "CANCELLED" });
    const target = await lookupTicketForRefund(ticket.code);
    expect(target!.canVoid).toBe(false);
    expect(target!.alreadyCancelled).toBe(true);
  });
});

describe("refundedSoFar", () => {
  it("counts issued and paid refunds", async () => {
    const { ticket } = await makeTicket({ paid: [500] });
    await makeRefund(ticket.id, 100, DocumentStatus.ISSUED);
    await makeRefund(ticket.id, 50, DocumentStatus.PAID);
    expect(await refundedSoFar(ticket.id)).toBe(150);
  });

  it("ignores drafts, so an abandoned one cannot block a real refund", async () => {
    const { ticket } = await makeTicket({ paid: [500] });
    await makeRefund(ticket.id, 500, DocumentStatus.DRAFT);
    expect(await refundedSoFar(ticket.id)).toBe(0);

    const target = await lookupTicketForRefund(ticket.code);
    expect(target!.refundable).toBe(500);
  });

  it("ignores voided refunds, which are cancelled promises", async () => {
    // A void refund never paid out. Counting it would permanently consume headroom and
    // leave the holder unable to be refunded for money we still hold.
    const { ticket } = await makeTicket({ paid: [500] });
    await makeRefund(ticket.id, 500, DocumentStatus.VOID);
    expect(await refundedSoFar(ticket.id)).toBe(0);
  });

  it("does not count refunds against a different ticket", async () => {
    const a = await makeTicket({ paid: [500] });
    const b = await makeTicket({ paid: [500] });
    await makeRefund(b.ticket.id, 500, DocumentStatus.ISSUED);
    expect(await refundedSoFar(a.ticket.id)).toBe(0);
  });
});

describe("checkRefundAmount", () => {
  it("accepts an amount up to what was paid", async () => {
    const { ticket } = await makeTicket({ paid: [500] });
    const target = (await lookupTicketForRefund(ticket.code))!;

    expect((await checkRefundAmount(target, 500)).ok).toBe(true);
    expect((await checkRefundAmount(target, 1)).ok).toBe(true);
  });

  it("refuses more than was paid", async () => {
    const { ticket } = await makeTicket({ paid: [500] });
    const target = (await lookupTicketForRefund(ticket.code))!;

    const result = await checkRefundAmount(target, 501);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/more than is left/i);
  });

  it("refuses zero and negative amounts", async () => {
    const { ticket } = await makeTicket({ paid: [500] });
    const target = (await lookupTicketForRefund(ticket.code))!;

    expect((await checkRefundAmount(target, 0)).ok).toBe(false);
    expect((await checkRefundAmount(target, -100)).ok).toBe(false);
    expect((await checkRefundAmount(target, 1.5)).ok).toBe(false);
  });

  it("refuses any refund on a ticket that was never paid for", async () => {
    const { ticket } = await makeTicket({ paid: [] });
    const target = (await lookupTicketForRefund(ticket.code))!;

    const result = await checkRefundAmount(target, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/nothing was ever paid/i);
  });

  it("re-reads the ledger, so a refund issued since the page loaded still caps it", async () => {
    // THE RACE THIS EXISTS FOR. Two crew members open the same complaint. Both pages
    // render "500 refundable". One issues 500. The second must not then be allowed to
    // issue 500 against a stale `target` - which is why checkRefundAmount re-queries
    // instead of trusting the refundable figure it was handed.
    const { ticket } = await makeTicket({ paid: [500] });
    const stale = (await lookupTicketForRefund(ticket.code))!;
    expect(stale.refundable).toBe(500);

    await makeRefund(ticket.id, 500, DocumentStatus.ISSUED);

    const result = await checkRefundAmount(stale, 500);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/already been refunded in full/i);
  });

  it("allows a second refund up to the remainder, and no further", async () => {
    const { ticket } = await makeTicket({ paid: [500] });
    await makeRefund(ticket.id, 200, DocumentStatus.ISSUED);
    const target = (await lookupTicketForRefund(ticket.code))!;

    expect(target.alreadyRefunded).toBe(200);
    expect(target.refundable).toBe(300);
    expect((await checkRefundAmount(target, 300)).ok).toBe(true);
    expect((await checkRefundAmount(target, 301)).ok).toBe(false);
  });
});

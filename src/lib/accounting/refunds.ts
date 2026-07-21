import "server-only";
import { DocumentKind, DocumentStatus } from "@prisma/client";
import { prisma } from "../db";

// Refunding a ticket.
//
// ---- WHAT THIS CAN AND CANNOT DO -----------------------------------------
//
// It CANNOT reverse the payment. A paid ticket is bought with Robux through a Roblox
// Developer Product and ProcessReceipt (see api/v1/tickets/purchase); Roblox holds that
// transaction and there is no API by which this application can undo it. Roblox has also
// already taken its 30% at source, and that 30% is not coming back either.
//
// So a refund here is TWO things, and neither is a reversal:
//
//   1. A RECORD - an authorised, numbered document saying this holder is owed this many
//      Robux, why, and who authorised it. That is the thing that can be shown later.
//   2. An INSTRUCTION - a human then pays those Robux out, by group payout or whatever
//      route is being used. The document carries the method; it does not perform it.
//
// The document says exactly this in its small print, because a refund document that
// implies the money has already moved is a document that causes an argument.
//
// ---- THE TWO GUARDS ------------------------------------------------------
//
// Both live here rather than in the page, because a cap enforced by a form is not a cap:
//
//   NEVER MORE THAN THEY PAID. The ceiling is the sum of that ticket's TicketPurchase
//   rows - what Roblox actually reported taking - not the tier's list price. A comped or
//   discounted ticket has a lower ceiling than its tier suggests, and a free ticket has a
//   ceiling of zero and cannot be refunded at all.
//
//   NEVER TWICE. Refunds already written against the ticket come off that ceiling, so a
//   second refund can only reach the remainder. Without this, two crew members working
//   the same complaint pay the same person out twice.

/** A ticket, resolved for refunding, with everything the decision needs. */
export type RefundTarget = {
  ticketId: string;
  code: string;
  status: "RESERVED" | "CHECKED_IN" | "CANCELLED";
  tierName: string | null;
  /** The holder, for the "refund to" line. */
  holderName: string;
  holderRobloxId: string;
  eventTitle: string;
  eventStartsAt: Date;
  /** What Roblox actually reported taking, across every purchase on this ticket. */
  paid: number;
  /** How many payments made it up - an upgrade is a second one. */
  payments: number;
  /** Already refunded on this ticket, from issued/paid refund documents. */
  alreadyRefunded: number;
  /** paid − alreadyRefunded. The ceiling on a new refund. Never negative. */
  refundable: number;
  /**
   * Can issuing a refund also cancel this ticket?
   *
   * False once they are CHECKED_IN: voidTicket() refuses those, and rightly - they are
   * already inside the room, and cancelling the ticket does not get them out of it while
   * leaving the door's record claiming somebody who never came in did. A refund for
   * somebody who attended is still perfectly possible; it just cannot take the ticket
   * back, because there is nothing left to take back.
   */
  canVoid: boolean;
  /** Already cancelled - so there is no ticket left to void, but a refund may still be owed. */
  alreadyCancelled: boolean;
};

/**
 * Find a ticket to refund, by its code or its id.
 *
 * Code is what the crew actually has - it is what a holder pastes into a DM - so it is
 * matched case-insensitively and with surrounding whitespace forgiven. Returns null
 * rather than throwing: an unknown code is a normal thing to type, not an error.
 */
export async function lookupTicketForRefund(
  query: string,
): Promise<RefundTarget | null> {
  const q = query.trim();
  if (!q) return null;

  const ticket = await prisma.ticket.findFirst({
    where: {
      OR: [{ code: { equals: q, mode: "insensitive" } }, { id: q }],
    },
    select: {
      id: true,
      code: true,
      status: true,
      tierName: true,
      user: { select: { robloxId: true, displayName: true, username: true } },
      event: { select: { title: true, startsAt: true } },
      purchases: { select: { robuxSpent: true } },
    },
  });
  if (!ticket) return null;

  // The ledger, not the list price. See the header: what they PAID is the ceiling.
  const paid = ticket.purchases.reduce((n, p) => n + p.robuxSpent, 0);
  const alreadyRefunded = await refundedSoFar(ticket.id);

  return {
    ticketId: ticket.id,
    code: ticket.code,
    status: ticket.status,
    tierName: ticket.tierName,
    holderName: ticket.user.displayName || ticket.user.username,
    holderRobloxId: ticket.user.robloxId,
    eventTitle: ticket.event.title,
    eventStartsAt: ticket.event.startsAt,
    paid,
    payments: ticket.purchases.length,
    alreadyRefunded,
    refundable: Math.max(0, paid - alreadyRefunded),
    canVoid: ticket.status === "RESERVED",
    alreadyCancelled: ticket.status === "CANCELLED",
  };
}

/**
 * What has already been refunded on a ticket.
 *
 * DRAFT refunds are excluded and VOID ones are excluded, for opposite reasons that land
 * in the same place. A draft is not a promise - it may be discarded, and counting it
 * would block a real refund behind an abandoned one. A void refund is a cancelled
 * promise - counting it would permanently consume headroom that was never paid out.
 * Only ISSUED and PAID are money owed or gone.
 */
export async function refundedSoFar(ticketId: string): Promise<number> {
  const agg = await prisma.accountingDocument.aggregate({
    where: {
      ticketId,
      kind: DocumentKind.TICKET_REFUND,
      status: { in: [DocumentStatus.ISSUED, DocumentStatus.PAID] },
    },
    _sum: { total: true },
  });
  return agg._sum.total ?? 0;
}

export type RefundCheck =
  | { ok: true; amount: number }
  | { ok: false; error: string };

/**
 * Validate a proposed refund amount against the ticket, at the moment of writing.
 *
 * Re-reads the ceiling rather than trusting the one the page rendered: between loading
 * the form and submitting it, another refund may have been issued against the same
 * ticket. That is exactly the race two crew members working one complaint produce.
 */
export async function checkRefundAmount(
  target: RefundTarget,
  amount: number,
): Promise<RefundCheck> {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { ok: false, error: "Enter a refund amount of at least 1 R$." };
  }

  if (target.paid <= 0) {
    return {
      ok: false,
      error:
        "Nothing was ever paid for this ticket, so there is nothing to refund. A free or comped ticket can be voided, but not refunded.",
    };
  }

  const refunded = await refundedSoFar(target.ticketId);
  const remaining = Math.max(0, target.paid - refunded);

  if (remaining <= 0) {
    return {
      ok: false,
      error: `This ticket has already been refunded in full (${refunded} R$).`,
    };
  }
  if (amount > remaining) {
    return {
      ok: false,
      error: `That is more than is left to refund on this ticket. Paid ${target.paid} R$, already refunded ${refunded} R$, so at most ${remaining} R$ remains.`,
    };
  }

  return { ok: true, amount };
}

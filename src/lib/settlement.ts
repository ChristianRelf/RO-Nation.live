import "server-only";
import { prisma } from "./db";

// What an org has taken in Robux, from the payment ledger - for a settlement
// statement. Read-only, and honest about being forward-looking: paid Robux ticketing
// is switched off platform-wide today (ROBUX_TICKETS_ENABLED, see lib/tickets/
// pricing.ts), so the ledger is empty and every figure here is 0 until the day the
// switch flips. The point of shipping it now is that a partner will need statements
// the moment it does, and the ledger it reads - TicketPurchase - has been recorded
// all along.
//
// Scope, the one honest way: a TicketPurchase has no partnerId of its own, so the
// only correct filter is through its ticket to its event - `ticket.event.partnerId`.
// eventScope is NULL for RNL, the slug for a partner. A shortcut would count another
// org's takings into this one's statement, which is the worst possible bug in a
// document about money.

/** A guard rail on the JS-side aggregation. Far above any real period's ledger. */
const LEDGER_CAP = 5000;

// The fee stack. A buyer pays the gross; Roblox takes 30% AT SOURCE, so RNL only
// ever receives the remaining 70%. RNL then takes its own 10% OF THAT 70% - not of
// the gross - and pays the partner the rest. On a 100 R$ ticket: Roblox 30, RNL 7,
// partner 63. All revenue lands in RNL's account first, which is the whole reason a
// payout statement has to be generated: it says who is owed what out of that pool.
export const ROBLOX_FEE_RATE = 0.3;
export const RNL_FEE_RATE = 0.1;

export type PayoutBreakdown = {
  /** What buyers paid, in total. */
  gross: number;
  /** Roblox's 30%, taken before RNL sees a Robux. */
  robloxFee: number;
  /** What RNL actually received - gross minus Roblox's cut. */
  afterRoblox: number;
  /** RNL's platform fee: 10% of what RNL received. */
  rnlFee: number;
  /** What the partner is owed - afterRoblox minus RNL's fee. */
  partnerPayout: number;
};

/**
 * Split a gross Robux figure into the fee stack.
 *
 * Integer Robux throughout, and rounded so the parts always add back to the whole:
 * robloxFee + rnlFee + partnerPayout === gross, exactly, with no lost or invented
 * Robux. That reconciliation is not cosmetic on a document about money.
 */
export function payoutFor(gross: number): PayoutBreakdown {
  const robloxFee = Math.round(gross * ROBLOX_FEE_RATE);
  const afterRoblox = gross - robloxFee;
  const rnlFee = Math.round(afterRoblox * RNL_FEE_RATE);
  const partnerPayout = afterRoblox - rnlFee;
  return { gross, robloxFee, afterRoblox, rnlFee, partnerPayout };
}

export type SettlementRow = {
  eventId: string;
  title: string;
  startsAt: Date;
  /** Paid tickets on this show (a purchase row each; an upgrade is a second row). */
  payments: number;
  robux: number;
};

export type Settlement = {
  totalRobux: number;
  totalPayments: number;
  shows: SettlementRow[];
  /** The fee stack over the whole total - computed once, so it reconciles exactly. */
  payout: PayoutBreakdown;
  /** True when the ledger had more rows than the cap, so the totals are partial. */
  capped: boolean;
};

/** An optional settlement window - a month, say. Omit for all-time. */
export type SettlementRange = { from?: Date; to?: Date };

export async function getSettlement(
  eventScope: string | null,
  range?: SettlementRange,
): Promise<Settlement> {
  const createdAt =
    range && (range.from || range.to)
      ? {
          ...(range.from ? { gte: range.from } : {}),
          ...(range.to ? { lt: range.to } : {}),
        }
      : undefined;

  const rows = await prisma.ticketPurchase.findMany({
    where: {
      ticket: { event: { partnerId: eventScope } },
      ...(createdAt ? { createdAt } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: LEDGER_CAP + 1,
    select: {
      robuxSpent: true,
      ticket: {
        select: { event: { select: { id: true, title: true, startsAt: true } } },
      },
    },
  });

  const capped = rows.length > LEDGER_CAP;
  const ledger = capped ? rows.slice(0, LEDGER_CAP) : rows;

  const byEvent = new Map<string, SettlementRow>();
  let totalRobux = 0;

  for (const row of ledger) {
    const ev = row.ticket.event;
    totalRobux += row.robuxSpent;
    const existing = byEvent.get(ev.id);
    if (existing) {
      existing.payments += 1;
      existing.robux += row.robuxSpent;
    } else {
      byEvent.set(ev.id, {
        eventId: ev.id,
        title: ev.title,
        startsAt: ev.startsAt,
        payments: 1,
        robux: row.robuxSpent,
      });
    }
  }

  const shows = [...byEvent.values()].sort(
    (a, b) => b.startsAt.getTime() - a.startsAt.getTime(),
  );

  return {
    totalRobux,
    totalPayments: ledger.length,
    shows,
    payout: payoutFor(totalRobux),
    capped,
  };
}

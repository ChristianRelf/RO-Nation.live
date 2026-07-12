// Ticket tiers and what they cost.
//
// Deliberately PURE — no prisma, no env, no "server-only". The checkout page
// (server) and the tier picker (client) both need to agree on what a tier costs,
// whether it is sold out and whether it is purchasable at all, and the only way
// two renderers cannot disagree is if they run the same code.
//
// That has one consequence worth stating plainly: NOTHING here is a security
// boundary. `locked` below is what a visitor is *shown*; it is not what stops a
// paid ticket being issued. The stop is in app/actions/tickets.ts, which re-reads
// the tier from the database and re-checks the kill switch on its own. A forged
// form body reaches that check, not this file.

import type { Partner } from "@/lib/partners/registry";

// ---- Robux ---------------------------------------------------------------

/**
 * Robux is the only currency, and there is deliberately no `currency` column
 * anywhere to say so: a Roblox event sells to Roblox players. If a second
 * currency ever appears, it belongs in the schema, not in a string here.
 */
export function formatRobux(amount: number) {
  return `${amount.toLocaleString("en-GB")} R$`;
}

/** "Free" or "250 R$" — the one place a price becomes words. */
export function priceLabel(priceRobux: number) {
  return priceRobux > 0 ? formatRobux(priceRobux) : "Free";
}

/**
 * May this organisation sell tickets for Robux at all?
 *
 * Two locks, and BOTH must be open:
 *
 *   1. `masterSwitch` — ROBUX_TICKETS_ENABLED, off by default. Robux cannot be
 *      charged from a website; a real payment happens inside the experience via
 *      a Developer Product and ProcessReceipt. Until that pipeline exists, no
 *      paid ticket can be honoured, so none may be issued. This is the switch
 *      that stays off.
 *
 *   2. `partner.robuxTickets` — which partners are even allowed to price in
 *      Robux once (1) is open. A slug in the registry grants nothing on its own;
 *      this is the grant. RNL's own events (partner === null) are governed by
 *      the master switch alone.
 *
 * Turning payments on is therefore a two-key operation, and flipping the env var
 * by itself cannot start charging a partner's visitors who were never signed up
 * for it.
 */
export function robuxSalesAllowed(
  partner: Partner | null,
  masterSwitch: boolean,
) {
  if (!masterSwitch) return false;
  return partner ? partner.robuxTickets === true : true;
}

// ---- Tiers ---------------------------------------------------------------

/** A tier as the UI needs it. `id: null` is the implicit free admission. */
export type Tier = {
  id: string | null;
  name: string;
  description: string | null;
  perks: string[];
  priceRobux: number;
  capacity: number;
};

/**
 * What an event offers when nobody has configured a tier.
 *
 * Every event that existed before this table did has no tier rows, and none of
 * them is broken: they are free general admission, which is exactly what they
 * always were. This is why shipping tiers needed no backfill.
 */
export const IMPLICIT_TIER: Tier = {
  id: null,
  name: "General Admission",
  description: null,
  perks: [],
  priceRobux: 0,
  capacity: 0,
};

type TierRow = {
  id: string;
  name: string;
  description: string | null;
  perks: string[];
  priceRobux: number;
  capacity: number;
  sortOrder: number;
  active: boolean;
};

/** The tiers on sale, in display order — or the implicit one if there are none. */
export function effectiveTiers(rows: readonly TierRow[]): Tier[] {
  const live = rows
    .filter((t) => t.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.priceRobux - b.priceRobux)
    .map(
      (t): Tier => ({
        id: t.id,
        name: t.name,
        description: t.description,
        perks: t.perks,
        priceRobux: t.priceRobux,
        capacity: t.capacity,
      }),
    );
  return live.length ? live : [IMPLICIT_TIER];
}

/** A tier, plus everything the checkout needs to decide if you can take it. */
export type TierOffer = Tier & {
  /** null = uncapped by this tier (the event's own capacity still applies). */
  remaining: number | null;
  soldOut: boolean;
  /** Priced in Robux, but Robux sales are off. Shown, and refused. */
  locked: boolean;
  /** The one reason it cannot be taken right now, if it cannot. */
  blockedReason: "soldout" | "locked" | null;
};

/**
 * Resolve every tier against live ticket counts.
 *
 * `eventRemaining` is the room's own headroom (null = unlimited). It caps every
 * tier: a tier with 50 seats in a room with 3 left offers 3, not 50. Getting
 * that backwards is how a show oversells.
 */
export function buildOffers({
  tiers,
  soldPerTier,
  eventRemaining,
  robuxAllowed,
}: {
  tiers: readonly Tier[];
  /** Live (non-cancelled) tickets per tier id. The implicit tier keys on "". */
  soldPerTier: ReadonlyMap<string, number>;
  eventRemaining: number | null;
  robuxAllowed: boolean;
}): TierOffer[] {
  return tiers.map((tier) => {
    const sold = soldPerTier.get(tier.id ?? "") ?? 0;

    const tierRemaining =
      tier.capacity > 0 ? Math.max(0, tier.capacity - sold) : null;

    // The tighter of the two caps wins. Either may be null (uncapped).
    const remaining =
      tierRemaining === null
        ? eventRemaining
        : eventRemaining === null
          ? tierRemaining
          : Math.min(tierRemaining, eventRemaining);

    const soldOut = remaining !== null && remaining <= 0;
    const locked = tier.priceRobux > 0 && !robuxAllowed;

    return {
      ...tier,
      remaining,
      soldOut,
      locked,
      // Sold out is the more useful thing to say when both are true.
      blockedReason: soldOut ? "soldout" : locked ? "locked" : null,
    };
  });
}

/** Can anything at all be taken? Drives the "sold out" state on the event page. */
export function anyAvailable(offers: readonly TierOffer[]) {
  return offers.some((o) => !o.blockedReason);
}

/** "Free", "From 250 R$", "250 R$" — the price line on an event card. */
export function fromPriceLabel(offers: readonly TierOffer[]) {
  const sellable = offers.filter((o) => !o.soldOut);
  const pool = sellable.length ? sellable : offers;
  if (pool.length === 0) return "Free";

  const prices = pool.map((o) => o.priceRobux);
  const low = Math.min(...prices);
  const high = Math.max(...prices);

  if (low === 0 && high === 0) return "Free";
  if (low === high) return formatRobux(low);
  return low === 0 ? "Free — paid tiers" : `From ${formatRobux(low)}`;
}

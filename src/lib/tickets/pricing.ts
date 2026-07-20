// Ticket tiers and what they cost.
//
// Deliberately PURE - no prisma, no env, no "server-only". The checkout page
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

/** "Free" or "250 R$" - the one place a price becomes words. */
export function priceLabel(priceRobux: number) {
  return priceRobux > 0 ? formatRobux(priceRobux) : "Free";
}

/**
 * May this organisation sell tickets for Robux at all?
 *
 * Two locks, and BOTH must be open:
 *
 *   1. `masterSwitch` - ROBUX_TICKETS_ENABLED, off by default. Robux cannot be
 *      charged from a website; a real payment happens inside the experience via
 *      a Developer Product and ProcessReceipt. Until that pipeline exists, no
 *      paid ticket can be honoured, so none may be issued. This is the switch
 *      that stays off.
 *
 *   2. `partner.robuxTickets` - which partners are even allowed to price in
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

/**
 * And may they sell on the GAME PASS rail specifically?
 *
 * A THIRD key, on top of the two above, and it is not paranoia - it guards a
 * prerequisite the other two cannot see.
 *
 * The game-pass rail needs something that lives outside this codebase entirely: the
 * Roblox OAuth application must be registered with the `user.inventory-item:read`
 * scope - the only one it needs, and the only one that exists for this. Without it, a
 * buyer goes to roblox.com, pays real Robux,
 * comes back - and we cannot ask Roblox whether they own the pass, because we were
 * never granted permission to look. They are charged, and they have no ticket.
 *
 * The other two switches cannot possibly know that. So this is its own key, off by
 * default, and turning it on is the deliberate act of somebody who has just gone and
 * configured the OAuth app. Flip the master switch alone and the DEV PRODUCT rail
 * works fine while the web checkout simply does not offer itself - which is the failure
 * you want, rather than the one where somebody's money vanishes.
 */
export function gamePassSalesAllowed(
  partner: Partner | null,
  masterSwitch: boolean,
  gamePassSwitch: boolean,
) {
  if (!gamePassSwitch) return false;
  return robuxSalesAllowed(partner, masterSwitch);
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

  /** The Roblox game pass that buys this on the WEB. Null = not sold that way. */
  gamePassId: string | null;

  /** The Developer Product that buys this IN-EXPERIENCE. Null = not sold that way. */
  devProductId: string | null;
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
  gamePassId: null,
  devProductId: null,
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
  gamePassId: string | null;
  devProductId: string | null;
};

/** The tiers on sale, in display order - or the implicit one if there are none. */
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
        gamePassId: t.gamePassId,
        devProductId: t.devProductId,
      }),
    );
  return live.length ? live : [IMPLICIT_TIER];
}

// ---- Rails ---------------------------------------------------------------

/**
 * How a tier can be paid for.
 *
 * THE SURFACE PICKS THE RAIL, NOT THE TIER - which is why this is two booleans and not
 * one enum. A buyer on the web buys the game PASS; a player at a booth inside the
 * experience buys the developer PRODUCT; and one tier may perfectly well offer both,
 * because they are the same seat sold in two places.
 *
 * An enum here would force a tier to choose, and the choice it would force is exactly
 * the wrong one: "this VIP ticket can be bought on the website OR at the door, but not
 * both" is not a rule anybody wants.
 */
export type Rails = {
  /** Buyable on roblox.com, in a browser. Verifiable afterwards. */
  gamePass: boolean;
  /** Buyable inside the experience, as a Developer Product. Giftable. */
  devProduct: boolean;
};

export function railsFor(tier: Tier): Rails {
  return {
    gamePass: Boolean(tier.gamePassId),
    devProduct: Boolean(tier.devProductId),
  };
}

/**
 * A priced tier that cannot be bought ANYWHERE, because nobody gave it a pass or a
 * product. It is not sold out and it is not locked - it is misconfigured, and the tier
 * editor says so in those words rather than letting a buyer find out at the checkout.
 *
 * Free tiers are never unsellable: they need no rail, because there is nothing to pay.
 */
export function isUnsellable(tier: Tier): boolean {
  if (tier.priceRobux <= 0) return false;
  const rails = railsFor(tier);
  return !rails.gamePass && !rails.devProduct;
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

  /**
   * On sale, but NOT ON THIS RAIL: bought at the booth inside the experience.
   *
   * ---- Why this is not a third blockedReason -----------------------------
   *
   * anyAvailable() below is `offers.some(o => !o.blockedReason)`, and it drives the
   * sold-out redirect on the reserve page. Fold this into blockedReason and a show
   * whose only tier is bought in-experience starts sending people to
   * `?error=soldout` - a flat lie about a show that is very much on sale, and one
   * that hides the actual instruction.
   *
   * So it is a separate, NON-BLOCKING fact: the tier is real, it is available, and
   * you buy it somewhere else. The checkout says that up front instead of letting
   * the buyer pick it and bounce off `ERRORS.payment_required` a screen later.
   */
  inExperienceOnly: boolean;
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
  gamePassAllowed,
}: {
  tiers: readonly Tier[];
  /** Live (non-cancelled) tickets per tier id. The implicit tier keys on "". */
  soldPerTier: ReadonlyMap<string, number>;
  eventRemaining: number | null;
  robuxAllowed: boolean;
  /**
   * Whether the WEB rail can sell at all - the game-pass switch, not the master one.
   *
   * Defaults to `robuxAllowed` so a caller that has not thought about it behaves
   * exactly as before this existed: no tier is marked in-experience-only, and
   * nothing about the checkout changes.
   */
  gamePassAllowed?: boolean;
}): TierOffer[] {
  const webRail = gamePassAllowed ?? robuxAllowed;

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

    // Priced, and sellable - just not from a browser. Either it carries no game
    // pass (so the web has nothing to sell) or the web rail is switched off, and
    // in both cases the dev product inside the experience is what buys it. Not
    // said about a tier that is already sold out or locked: those have a more
    // useful thing to say.
    const inExperienceOnly =
      !soldOut &&
      !locked &&
      tier.priceRobux > 0 &&
      Boolean(tier.devProductId) &&
      (!webRail || !tier.gamePassId);

    return {
      ...tier,
      remaining,
      soldOut,
      locked,
      // Sold out is the more useful thing to say when both are true.
      blockedReason: soldOut ? "soldout" : locked ? "locked" : null,
      inExperienceOnly,
    };
  });
}

/** Can anything at all be taken? Drives the "sold out" state on the event page. */
export function anyAvailable(offers: readonly TierOffer[]) {
  return offers.some((o) => !o.blockedReason);
}

/** "Free", "From 250 R$", "250 R$" - the price line on an event card. */
export function fromPriceLabel(offers: readonly TierOffer[]) {
  const sellable = offers.filter((o) => !o.soldOut);
  const pool = sellable.length ? sellable : offers;
  if (pool.length === 0) return "Free";

  const prices = pool.map((o) => o.priceRobux);
  const low = Math.min(...prices);
  const high = Math.max(...prices);

  if (low === 0 && high === 0) return "Free";
  if (low === high) return formatRobux(low);
  return low === 0 ? "Free - paid tiers" : `From ${formatRobux(low)}`;
}

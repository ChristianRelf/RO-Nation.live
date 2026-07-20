import "server-only";
import type { IssueReason } from "@/lib/tickets/issue";
import type { IntentReason } from "@/lib/tickets/intents";

// The sentence that goes with each refusal.
//
// `reason` is the machine's answer and never changes - branch on that. `message`
// is the same answer for a person, and it is written to be shown to whoever is
// standing there: on a GUI in the experience, in a crew member's chat, in a log a
// human will read at 2am. It may be reworded at any time. Do not parse it.
//
// Both are always sent, for every refusal, from every endpoint. A game that only
// has the reason has to invent the wording itself, and every game inventing its
// own wording is how "sold out" and "you're banned" end up looking identical to
// the person reading them.

export const ISSUE_MESSAGES: Record<Exclude<IssueReason, "ok">, string> = {
  not_found: "No such show.",
  unavailable: "This show isn't open for tickets.",
  past: "This show has already happened.",
  badtier: "That ticket type isn't available for this show.",
  soldout: "This show is sold out.",
  tier_soldout: "That tier is sold out.",
  no_player: "Roblox doesn't know that player.",
  revoked: "This player's ticket for this show was revoked. They cannot get another.",
  payments_off: "Paid tickets aren't switched on. That tier can't be issued to anybody.",
  payment_required:
    "That tier costs Robux. Prompt the Developer Product, then call /purchase from ProcessReceipt.",
  not_purchasable: "That tier is free - don't charge for it. Use /reserve.",

  // The double-sell guard. One ticket per player per show, and they already hold this one
  // at this tier or better - so a Developer Product purchase for it buys nothing. Do NOT
  // prompt a product for a tier a player already holds: call POST /verify with their
  // robloxId first, and only prompt when they hold nothing. If a purchase was taken anyway,
  // return NotProcessedYet and refund it by hand - there is no second ticket to give them.
  already_owned:
    "They already hold this show's ticket at this tier or better. There is nothing to sell them - do not prompt, and if they were charged, refund it. Check /verify before prompting.",

  bad_intent:
    "That hold isn't valid: it has expired beyond recovery, belongs to somebody else, or was already spent. Create a new one with POST /intents.",

  // NOT a failure, and the wording has to carry that or a game will show it as one.
  //
  // Roblox's inventory lags a purchase by seconds. For the whole of that gap this is the
  // answer, and the only correct response to it is to WAIT and ask again. A game that
  // renders this as "payment failed" will make people pay twice - so the sentence says,
  // in as many words, that it is not a failure.
  not_paid:
    "Roblox doesn't show that pass in their inventory yet. This is normal for a few seconds after a purchase - keep polling. It does NOT mean the payment failed; do not tell them it did.",

  // Kept apart from not_paid on purpose. This one means WE are broken.
  verify_unavailable:
    "We couldn't reach Roblox to check the purchase. Nothing has been decided - do not tell them they haven't paid. Try again shortly.",

  needs_consent:
    "They haven't given us permission to check their Roblox inventory, so we can't confirm the purchase. Send them back to the website to reconnect - this is a button, not a wait.",

  seat_taken:
    "That seat has gone and there's nothing left in that tier to move them to. If they have already been charged, this one needs a refund by hand.",
};

/** Why a hold could not be taken. Same contract: branch on `reason`, show `message`. */
export const INTENT_MESSAGES: Record<IntentReason, string> = {
  not_found: "No such show.",
  unavailable: "This show isn't open for tickets.",
  past: "This show has already happened.",
  badtier: "That ticket type isn't available for this show.",
  no_player: "Roblox doesn't know that player.",
  revoked: "This player's ticket for this show was revoked. They cannot get another.",
  already_holds: "They already have a ticket for this show. One per player, per show.",
  soldout: "This show is sold out - there is nothing left to hold.",
  tier_soldout: "That tier is sold out.",

  // The one that costs money if you get it wrong. There is nothing left in this tier to move
  // them to, so DO NOT PROMPT the purchase - a player who pays now cannot be given a seat.
  seat_taken:
    "Every seat in that tier has gone. Do not prompt for payment - there is nothing to sell them. Offer another tier.",

  payments_off: "Paid tickets aren't switched on. That tier can't be sold to anybody.",
  unsellable:
    "That tier is priced but has no Developer Product and no game pass, so nobody can buy it anywhere. It is misconfigured, not sold out - tell the organisers.",
  bad_rail:
    "That tier has no Developer Product, so it cannot be bought inside the experience. It may still be on sale on the website.",
  cannot_gift:
    "A game pass cannot be bought for somebody else - it lands in the buyer's inventory. Gift with a Developer Product instead.",
};

export const VOID_MESSAGES = {
  not_found: "No ticket to void.",
  checked_in:
    "They are already inside. A checked-in ticket cannot be voided - the door has already let them through, and cancelling the record now would only make it lie.",
} as const;

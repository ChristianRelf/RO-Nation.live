import "server-only";
import type { IssueReason } from "@/lib/tickets/issue";

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

export const VOID_MESSAGES = {
  not_found: "No ticket to void.",
  checked_in:
    "They are already inside. A checked-in ticket cannot be voided - the door has already let them through, and cancelling the record now would only make it lie.",
} as const;

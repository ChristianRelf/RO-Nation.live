import { NextRequest, NextResponse } from "next/server";
import {
  authorize,
  badRequest,
  readJson,
  resolveEventId,
  str,
} from "@/lib/api/guard";
import { ticketEnvelope } from "@/lib/api/lookup";
import { ISSUE_MESSAGES } from "@/lib/api/messages";
import { prisma } from "@/lib/db";
import { issueTicket } from "@/lib/tickets/issue";

export const dynamic = "force-dynamic";

// POST /api/v1/tickets/purchase - somebody paid Robux. Give them the ticket.
//
// Auth:  x-api-key: <key>          scope: TICKETS_PURCHASE
// Body:  { purchaseId, robloxId, eventId, tierId, robuxSpent?, placeId?, productId? }
//
// CALL THIS FROM ProcessReceipt, AND NOWHERE ELSE.
//
// ---- What this endpoint trusts, and what it does not ----------------------
//
// Robux cannot be charged from a website. A real payment is a Developer Product
// prompted inside the Roblox experience, and the ONLY witness to it is the
// ProcessReceipt handler running on the game server. Roblox offers no
// server-to-server call for us to ask "was purchase X really paid for?" - so we
// cannot check. We take the game server's word for it.
//
// That is the trust boundary, and it is worth staring at rather than skimming:
// anybody holding a key with this scope can assert that anybody paid for
// anything, and get a paid ticket for free. Give this scope only to a place you
// would trust with your own Robux, and revoke it the moment a key leaks.
//
// ---- What it DOES guarantee ----------------------------------------------
//
// That a payment is honoured EXACTLY ONCE. `purchaseId` is Roblox's own
// PurchaseId, and it is the idempotency key. ProcessReceipt is explicitly
// at-least-once - Roblox re-delivers a receipt until the game returns
// PurchaseGranted, and a server that crashes mid-call WILL send it again. So:
//
//   • Send the same purchaseId twice and the second call returns the SAME ticket,
//     `created: false`, and takes no second payment. Retry freely; a dropped
//     response is safe to re-send, and you should re-send it.
//   • It is checked before anything else can refuse - before the show is sold out,
//     before it is past, before the tier is deactivated. Somebody who has ALREADY
//     BEEN CHARGED must never be told they have no ticket because the room filled
//     up while their receipt was in flight.
//   • If they already hold a ticket for this show, the payment UPGRADES it (one
//     ticket per person per show, always). It is never silently swallowed: taking
//     Robux and changing nothing is theft with extra steps.
//
// Return PurchaseGranted to Roblox only once this has answered `issued: true`. If
// it answers `issued: false`, do NOT grant - return NotProcessedYet and let Roblox
// re-deliver, or refund. `payments_off` means the tier cannot be issued to anybody
// today, so do not prompt for it at all: read GET /api/v1/events/<id> first, and
// only prompt for a tier that says `available: true`.
//
// ---- Seated shows: `intentToken` is REQUIRED -------------------------------
//
// If the event's `seatMode` is anything but NONE, this endpoint refuses a purchase with no
// hold - and it is not being fussy. You cannot sell a numbered seat on the word of a game
// server that has no idea which seat: without a hold, two booths in two servers would both
// prompt for the same chair, both receipts would land, and exactly one of the two people who
// paid Robux would get it.
//
// So the booth's flow on a seated show is: POST /intents (which allocates the chair, under
// the lock) → PromptProductPurchase → ProcessReceipt → POST here WITH the token.
//
// An EXPIRED hold is still accepted, and that is deliberate. They have already been charged
// - the money moved on a screen we do not control - so an expiry costs them THE SEAT THEY
// PICKED, not the ticket they paid for: they fall back to the best available chair in the
// same tier. The only true refusal is `seat_taken`, which means the whole tier is gone, and
// it is the one case that needs a refund by hand.
//
// Unseated shows are UNCHANGED: the token stays optional, and every booth that exists today
// keeps working without being touched.

export async function POST(req: NextRequest) {
  const auth = await authorize(req, "TICKETS_PURCHASE");
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(req);
  const purchaseId = str(body.purchaseId);
  const robloxId = str(body.robloxId);
  const tierId = str(body.tierId);
  const intentToken = str(body.intentToken);

  // No purchaseId, no idempotency - and without idempotency a retried receipt is
  // a second ticket. Refuse rather than take the risk on the caller's behalf.
  if (!purchaseId || !robloxId || !str(body.eventId) || !tierId) {
    return badRequest(
      "provide `purchaseId` (from ProcessReceipt), `robloxId`, `eventId` and `tierId`",
    );
  }

  // An id OR a slug. A booth holds ONE event identifier in ONE constant and passes it to
  // every endpoint it calls; if the reads take a slug and the writes do not, that constant
  // is wrong for half of them and there is nothing in the failure to say which half.
  const eventId = await resolveEventId(str(body.eventId));
  if (!eventId) {
    return NextResponse.json({
      ok: true,
      issued: false,
      reason: "not_found",
      message: ISSUE_MESSAGES.not_found,
      ticket: null,
      event: null,
      holder: null,
    });
  }

  // A seated show with no hold. Refused HERE, before issueTicket, so the caller gets a
  // sentence that tells them what to do instead of a generic refusal - this is the one
  // mistake an integrator will make, and they will make it at 2am on the night of a show.
  if (!intentToken) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { seatMode: true },
    });

    if (event && event.seatMode !== "NONE") {
      return badRequest(
        "this show has numbered seating, so `intentToken` is required - hold a seat with POST /api/v1/intents first, then pass its token here. Without it we do not know which seat they bought.",
      );
    }
  }

  const robuxSpent =
    typeof body.robuxSpent === "number" && Number.isFinite(body.robuxSpent)
      ? Math.max(0, Math.round(body.robuxSpent))
      : 0;

  const outcome = await issueTicket({
    eventId,
    holder: { robloxId },
    tierId,
    scope: auth.caller.scope,
    mode: {
      kind: "purchase",
      purchaseId,
      robuxSpent,
      placeId: str(body.placeId),
      productId: str(body.productId),
      // The seat they have been holding since the booth allocated it. issueTicket re-reads
      // it under the row lock and refuses it if it is not this event's, this tier's and this
      // person's - a token in a request body is not evidence of anything.
      intentToken,
      // Which key said the money changed hands. The audit trail for the one thing
      // in this system nothing can independently verify.
      apiKeyId: auth.caller.id,
    },
  });

  if (!outcome.ok) {
    return NextResponse.json({
      ok: true,
      issued: false,
      reason: outcome.reason,
      message: ISSUE_MESSAGES[outcome.reason],
      ticket: null,
      event: null,
      holder: null,
    });
  }

  return ticketEnvelope(outcome.ticketId, auth.caller, {
    issued: true,
    // false on a re-delivered receipt, or on an upgrade of a ticket they held.
    // Either way they have their ticket and you may grant.
    created: !outcome.existing,
  });
}

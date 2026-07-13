import { NextRequest, NextResponse } from "next/server";
import { authorize, badRequest, readJson, str } from "@/lib/api/guard";
import { ticketEnvelope } from "@/lib/api/lookup";
import { ISSUE_MESSAGES } from "@/lib/api/messages";
import { issueTicket } from "@/lib/tickets/issue";

export const dynamic = "force-dynamic";

// POST /api/v1/tickets/purchase — somebody paid Robux. Give them the ticket.
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
// server-to-server call for us to ask "was purchase X really paid for?" — so we
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
// at-least-once — Roblox re-delivers a receipt until the game returns
// PurchaseGranted, and a server that crashes mid-call WILL send it again. So:
//
//   • Send the same purchaseId twice and the second call returns the SAME ticket,
//     `created: false`, and takes no second payment. Retry freely; a dropped
//     response is safe to re-send, and you should re-send it.
//   • It is checked before anything else can refuse — before the show is sold out,
//     before it is past, before the tier is deactivated. Somebody who has ALREADY
//     BEEN CHARGED must never be told they have no ticket because the room filled
//     up while their receipt was in flight.
//   • If they already hold a ticket for this show, the payment UPGRADES it (one
//     ticket per person per show, always). It is never silently swallowed: taking
//     Robux and changing nothing is theft with extra steps.
//
// Return PurchaseGranted to Roblox only once this has answered `issued: true`. If
// it answers `issued: false`, do NOT grant — return NotProcessedYet and let Roblox
// re-deliver, or refund. `payments_off` means the tier cannot be issued to anybody
// today, so do not prompt for it at all: read GET /api/v1/events/<id> first, and
// only prompt for a tier that says `available: true`.

export async function POST(req: NextRequest) {
  const auth = await authorize(req, "TICKETS_PURCHASE");
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(req);
  const purchaseId = str(body.purchaseId);
  const robloxId = str(body.robloxId);
  const eventId = str(body.eventId);
  const tierId = str(body.tierId);

  // No purchaseId, no idempotency — and without idempotency a retried receipt is
  // a second ticket. Refuse rather than take the risk on the caller's behalf.
  if (!purchaseId || !robloxId || !eventId || !tierId) {
    return badRequest(
      "provide `purchaseId` (from ProcessReceipt), `robloxId`, `eventId` and `tierId`",
    );
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

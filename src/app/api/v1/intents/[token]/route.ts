import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/api/guard";
import { prisma } from "@/lib/db";
import { findIntent } from "@/lib/tickets/intents";

export const dynamic = "force-dynamic";

// One hold, by its token.
//
//   GET     resolve it   - what is this token? scope: EVENTS_READ
//   DELETE  release it   - they said no.       scope: INTENTS_WRITE
//
// ---- GET: this is what makes launchData work -------------------------------
//
// A player buys on the website, we deep-link them into the experience with
// `?launchData=<token>`, and the game reads it back with
// `player:GetJoinData().LaunchData`. At that point the game has a string and no idea what it
// means. This is where it finds out: which show, which tier, which seat, and whether it has
// already been spent.
//
// That is the entire "start on the web, finish in the game" journey, and it is one GET.

/** The hold, shaped for a game. Never leaks who the buyer is beyond their Roblox id. */
function envelope(intent: NonNullable<Awaited<ReturnType<typeof findIntent>>>) {
  const live =
    intent.status === "PENDING" && intent.expiresAt.getTime() > Date.now();

  return {
    token: intent.token,
    // PENDING | CONSUMED | CANCELLED. `live` is the one to branch on: it folds in expiry,
    // which status alone does not (an expired row is still PENDING - there is no sweeper,
    // and every reader simply stops counting it. See intents.ts).
    status: intent.status,
    live,
    expiresAt: intent.expiresAt,

    eventId: intent.eventId,
    eventSlug: intent.event.slug,
    tierId: intent.tierId,
    tierName: intent.tier?.name ?? null,

    robloxId: intent.beneficiary.robloxId,

    priceRobux: intent.priceRobux,
    devProductId: intent.tier?.devProductId ?? null,

    seatKey: intent.seatKey,
    sectionKey: intent.sectionKey,

    // What it BECAME, if it has already been spent. A player who re-joins with the same
    // launchData must be shown their ticket, not sold a second one.
    ticketId: intent.ticketId,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const auth = await authorize(req, "EVENTS_READ");
  if (auth instanceof NextResponse) return auth;

  const intent = await findIntent(params.token?.trim() ?? "");

  const missing = NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (!intent) return missing;

  // Scoped, like everything else: a token for another org's show is not found, full stop.
  // Never "not yours" - that confirms it exists to somebody with no business knowing.
  const partnerId = intent.event.partnerId ?? null;
  if (auth.caller.scope !== undefined && partnerId !== auth.caller.scope) return missing;

  return NextResponse.json({ ok: true, intent: envelope(intent) });
}

// ---- DELETE: give the seat back --------------------------------------------
//
// Call this from PromptProductPurchaseFinished when `wasPurchased == false`. They dismissed
// the prompt, and the chair they were holding should go back on sale NOW rather than in ten
// minutes' time.
//
// Nothing breaks if you never call it - the hold dies on its own, and every reader ignores an
// expired one (there is no sweeper; see intents.ts). Calling it just means the next person
// sees the seat immediately instead of staring at a chair nobody wants.

export async function DELETE(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const auth = await authorize(req, "INTENTS_WRITE");
  if (auth instanceof NextResponse) return auth;

  const token = params.token?.trim() ?? "";
  const intent = await findIntent(token);

  const missing = NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (!intent) return missing;

  const partnerId = intent.event.partnerId ?? null;
  if (auth.caller.scope !== undefined && partnerId !== auth.caller.scope) return missing;

  // Only a PENDING hold can be released. A CONSUMED one has already become a ticket, and
  // "releasing" it would be a lie that quietly frees a seat somebody is now sitting in.
  const { count } = await prisma.purchaseIntent.updateMany({
    where: { token, status: "PENDING" },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json({
    ok: true,
    // false when it was already spent, already cancelled, or already gone. Not an error -
    // there is nothing for the caller to do about any of them, and a dismissed prompt
    // arriving after the purchase landed is an ordinary race, not a fault.
    released: count > 0,
  });
}

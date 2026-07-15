import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { issueTicket } from "@/lib/tickets/issue";
import { resetDb, makeEvent, makePaidTier, makeUser } from "./helpers";

// Payment idempotency, ported from check-seating.ts item 5.
//
// The one property that matters for money: Roblox's ProcessReceipt is at-least-once,
// so the same PurchaseId WILL arrive more than once. Honour it twice and somebody
// has two tickets for one payment - or, worse, a second payment row implies a second
// charge that never happened. The guarantee is: same PurchaseId → same ticket, and
// exactly one TicketPurchase row, forever.

beforeEach(resetDb);

describe("purchase idempotency", () => {
  it("the same PurchaseId twice yields one ticket and one payment row", async () => {
    const event = await makeEvent({ capacity: 0 });
    const tier = await makePaidTier(event.id);
    const user = await makeUser();
    const purchaseId = `pid-${Date.now()}-a`;

    const mode = { kind: "purchase" as const, purchaseId, robuxSpent: 100 };

    const first = await issueTicket({
      eventId: event.id,
      holder: { userId: user.id },
      tierId: tier.id,
      scope: null,
      mode,
    });
    const second = await issueTicket({
      eventId: event.id,
      holder: { userId: user.id },
      tierId: tier.id,
      scope: null,
      mode,
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      // The retry gets the SAME ticket, flagged as pre-existing.
      expect(second.ticketId).toBe(first.ticketId);
      expect(second.existing).toBe(true);
    }

    const payments = await prisma.ticketPurchase.count({ where: { purchaseId } });
    expect(payments).toBe(1);
  });

  it("cancel then re-claim the same PurchaseId restores the ticket without double-charging", async () => {
    const event = await makeEvent({ capacity: 0 });
    const tier = await makePaidTier(event.id);
    const user = await makeUser();
    const purchaseId = `pid-${Date.now()}-b`;
    const mode = { kind: "purchase" as const, purchaseId, robuxSpent: 100 };

    const first = await issueTicket({
      eventId: event.id,
      holder: { userId: user.id },
      tierId: tier.id,
      scope: null,
      mode,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    // They cancel - the row goes CANCELLED and gives its seat back (unseated here,
    // so seatKey is already null). A game pass could never be re-paid, so the
    // restore path has to work off the original PurchaseId.
    await prisma.ticket.update({
      where: { id: first.ticketId },
      data: { status: "CANCELLED", seatKey: null, sectionKey: null },
    });

    // The same receipt arrives again (or they re-trigger the claim). It must rebuild
    // the ticket rather than hand back the cancelled husk.
    const again = await issueTicket({
      eventId: event.id,
      holder: { userId: user.id },
      tierId: tier.id,
      scope: null,
      mode,
    });
    expect(again.ok).toBe(true);
    if (!again.ok) return;

    const restored = await prisma.ticket.findUnique({
      where: { id: again.ticketId },
      select: { status: true },
    });
    expect(restored?.status).not.toBe("CANCELLED");

    // Still exactly one payment row - the money changed hands once.
    const payments = await prisma.ticketPurchase.count({ where: { purchaseId } });
    expect(payments).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Deferred: seat-level tests that need a seated venue fixture (a VenueMap with a
// parseable layout, cloned onto the event, plus tiers assigned to its sections).
// They are real and worth adding - the throwaway check-seating.ts covered them -
// but their fixtures are involved enough that a hand-rolled, unverified one risks
// the "green test that proves nothing" trap SEATING.md warns about. Build the
// fixture from lib/venue/presets.ts before filling these in.
// ---------------------------------------------------------------------------
describe.todo("seat allocation (needs a seated venue fixture)");
describe.todo("hold expiry falls back to best-available (needs a seated venue fixture)");

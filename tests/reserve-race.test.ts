import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { issueTicket } from "@/lib/tickets/issue";
import { resetDb, makeEvent, makeUser } from "./helpers";

// The concurrency guarantees, exercised against real Postgres row locks. Ported
// from the throwaway check-seating.ts described in SEATING.md - the race and the
// no-oversell invariant, which are the two ways the money logic can go wrong under
// load and the two things unit tests over a mock can never catch.

beforeEach(resetDb);

describe("reserve concurrency", () => {
  it("one holder racing themselves ends up with exactly one ticket", async () => {
    // The @@unique([eventId, userId]) + the event row lock: eight simultaneous
    // reserves for the SAME person must collapse to a single ticket, not eight.
    const event = await makeEvent({ capacity: 0 });
    const user = await makeUser();

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        issueTicket({
          eventId: event.id,
          holder: { userId: user.id },
          scope: null,
          mode: { kind: "reserve" },
        }),
      ),
    );

    // Every attempt succeeds (a repeat reserve is not an error - it hands back the
    // ticket they already hold), but there is only ever one row.
    expect(results.every((r) => r.ok)).toBe(true);

    const tickets = await prisma.ticket.findMany({
      where: { eventId: event.id, userId: user.id, status: { not: "CANCELLED" } },
    });
    expect(tickets).toHaveLength(1);

    // Exactly one attempt actually minted it; the rest found the existing one.
    const minted = results.filter((r) => r.ok && r.existing === false);
    expect(minted).toHaveLength(1);
  });

  it("capacity of one, many buyers: exactly one wins and the room never oversells", async () => {
    // The core no-double-sell property. Eight different people reserve the last
    // seat at once; one gets it, seven are told soldout, and the ticket count is
    // never two.
    const event = await makeEvent({ capacity: 1 });
    const users = await Promise.all(Array.from({ length: 8 }, () => makeUser()));

    const results = await Promise.all(
      users.map((u) =>
        issueTicket({
          eventId: event.id,
          holder: { userId: u.id },
          scope: null,
          mode: { kind: "reserve" },
        }),
      ),
    );

    const winners = results.filter((r) => r.ok);
    expect(winners).toHaveLength(1);

    const losers = results.filter((r) => !r.ok);
    expect(losers.every((r) => !r.ok && r.reason === "soldout")).toBe(true);

    const count = await prisma.ticket.count({
      where: { eventId: event.id, status: { not: "CANCELLED" } },
    });
    expect(count).toBe(1);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { issueTicket } from "@/lib/tickets/issue";
import { createPurchaseIntent } from "@/lib/tickets/intents";
import { resetDb, makeEvent, makeUser } from "./helpers";

// Presale: the show is PUBLISHED and visible, but tickets are not on sale yet. The
// button reads "Tickets unavailable" on the website; here we prove the LOCK behind
// it - a hidden button is a decoration, so the refusal has to live in issueTicket
// and createPurchaseIntent, which the game API and the checkout both go through.

beforeEach(resetDb);

describe("presale", () => {
  it("refuses a public reserve while in presale", async () => {
    const event = await makeEvent({ presale: true });
    const user = await makeUser();

    const outcome = await issueTicket({
      eventId: event.id,
      holder: { userId: user.id },
      scope: null,
      mode: { kind: "reserve" },
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.reason).toBe("not_on_sale");

    // Nothing was issued.
    const count = await prisma.ticket.count({ where: { eventId: event.id } });
    expect(count).toBe(0);
  });

  it("still lets a gift/comp through - VIPs can be seeded before doors open", async () => {
    const event = await makeEvent({ presale: true });
    const user = await makeUser();

    const outcome = await issueTicket({
      eventId: event.id,
      holder: { userId: user.id },
      scope: null,
      mode: { kind: "gift", byRobloxId: "1", byName: "Crew" },
    });

    expect(outcome.ok).toBe(true);
  });

  it("refuses a seat hold while in presale", async () => {
    const event = await makeEvent({ presale: true });
    const user = await makeUser();

    const held = await createPurchaseIntent({
      eventId: event.id,
      payer: { userId: user.id },
      tierId: null,
      scope: null,
    });

    expect(held.ok).toBe(false);
    expect(held.ok === false && held.reason).toBe("not_on_sale");
  });

  it("sells normally the moment presale is switched off", async () => {
    const event = await makeEvent({ presale: true });
    const user = await makeUser();

    await prisma.event.update({ where: { id: event.id }, data: { presale: false } });

    const outcome = await issueTicket({
      eventId: event.id,
      holder: { userId: user.id },
      scope: null,
      mode: { kind: "reserve" },
    });

    expect(outcome.ok).toBe(true);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { issueTicket } from "@/lib/tickets/issue";
import { createPurchaseIntent } from "@/lib/tickets/intents";
import { gamePassSalesAllowed, robuxSalesAllowed } from "@/lib/tickets/pricing";
import type { Partner } from "@/lib/partners/registry";
import { resetDb, makeEvent, makeGamePassTier, makeUser } from "./helpers";

// The GAME PASS rail - the one where somebody pays real Robux on roblox.com and we
// verify it afterwards by asking Roblox whether they own the pass.
//
// This rail shipped with no test coverage at all, which is a strange place for the
// money path to be. What follows covers the four properties that cost somebody
// something if they break:
//
//   1. The three switches. Any one of them shut means no sale.
//   2. A pass cannot be gifted - the refusal that keeps us from asking Roblox about
//      the wrong person and calling a paying customer a liar.
//   3. One pass, one ticket, forever - across repeated claims.
//   4. The three-state answer. "We could not ask" must never be rendered as "you
//      did not pay".
//
// ---- On mocking ------------------------------------------------------------
//
// ownsGamePass() is stubbed, because the thing it talks to is Roblox and the thing
// under test is what WE do with each of its three answers. gamePassPurchaseId() is
// deliberately NOT stubbed - it is pure, and it is the actual subject of the
// idempotency test below. Stub it and test 3 would be testing the stub.

const { ownsGamePass } = vi.hoisted(() => ({ ownsGamePass: vi.fn() }));

vi.mock("@/lib/roblox-gamepass", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/roblox-gamepass")>()),
  ownsGamePass,
}));

/** They own it. The happy answer. */
const owns = () => ownsGamePass.mockResolvedValue({ ok: true, owns: true });
/** Roblox answered, and the pass is not in their inventory (yet). */
const ownsNot = () => ownsGamePass.mockResolvedValue({ ok: true, owns: false });
/** We could not ask. */
const cannotAsk = (reason: "no_grant" | "unavailable") =>
  ownsGamePass.mockResolvedValue({ ok: false, reason });

beforeEach(async () => {
  await resetDb();
  ownsGamePass.mockReset();
});

/** A hold on the game-pass rail, ready to be claimed. */
async function holdGamePass(eventId: string, tierId: string, userId: string) {
  const intent = await createPurchaseIntent({
    eventId,
    payer: { userId },
    tierId,
    rail: "GAME_PASS",
    scope: null,
  });
  expect(intent.ok).toBe(true);
  if (!intent.ok) throw new Error("fixture: intent refused");
  return intent.token;
}

// ---------------------------------------------------------------------------
describe("the three switches", () => {
  // Pure functions - no database, no env. The switches are passed in explicitly so
  // this matrix says what the rule IS, rather than what today's .env happens to say.
  const partner = (robuxTickets: boolean) =>
    ({ slug: "x", name: "X", robuxTickets }) as unknown as Partner;

  it("needs the master switch, whoever is asking", () => {
    expect(robuxSalesAllowed(null, false)).toBe(false);
    expect(robuxSalesAllowed(partner(true), false)).toBe(false);
    expect(robuxSalesAllowed(null, true)).toBe(true);
  });

  it("needs the partner's own grant on top of it", () => {
    expect(robuxSalesAllowed(partner(false), true)).toBe(false);
    expect(robuxSalesAllowed(partner(true), true)).toBe(true);
  });

  it("needs the game-pass key on top of BOTH of those", () => {
    // The master switch alone leaves the web rail shut. This is the case the third
    // key exists for: the dev-product rail works, the web checkout offers nothing.
    expect(gamePassSalesAllowed(null, true, false)).toBe(false);
    expect(gamePassSalesAllowed(null, true, true)).toBe(true);
  });

  it("cannot be opened by the game-pass key alone", () => {
    // The dangerous inversion. If this ever returns true, ROBUX_GAMEPASS_ENABLED has
    // become a bypass for the master switch rather than an addition to it.
    expect(gamePassSalesAllowed(null, false, true)).toBe(false);
    expect(gamePassSalesAllowed(partner(true), false, true)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("a game pass cannot be gifted", () => {
  it("refuses a GAME_PASS hold bought for somebody else", async () => {
    const event = await makeEvent({ capacity: 0 });
    const tier = await makeGamePassTier(event.id);
    // Numeric ids, because the beneficiary is named BY robloxId and resolveUserId()
    // rejects any other shape before the gifting rule is ever reached.
    const payer = await makeUser({ numericRobloxId: true });
    const friend = await makeUser({ numericRobloxId: true });

    const intent = await createPurchaseIntent({
      eventId: event.id,
      payer: { userId: payer.id },
      beneficiaryRobloxId: friend.robloxId,
      tierId: tier.id,
      rail: "GAME_PASS",
      scope: null,
    });

    expect(intent.ok).toBe(false);
    if (!intent.ok) expect(intent.reason).toBe("cannot_gift");
  });

  it("allows the same hold for oneself", async () => {
    const event = await makeEvent({ capacity: 0 });
    const tier = await makeGamePassTier(event.id);
    const payer = await makeUser({ numericRobloxId: true });

    // Naming yourself as the beneficiary is not gifting, and must not trip the rule.
    const intent = await createPurchaseIntent({
      eventId: event.id,
      payer: { userId: payer.id },
      beneficiaryRobloxId: payer.robloxId,
      tierId: tier.id,
      rail: "GAME_PASS",
      scope: null,
    });

    expect(intent.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("one pass, one ticket", () => {
  it("claiming twice yields one ticket and one payment row", async () => {
    owns();
    const event = await makeEvent({ capacity: 0 });
    const tier = await makeGamePassTier(event.id);
    const user = await makeUser();

    const first = await issueTicket({
      eventId: event.id,
      holder: { userId: user.id },
      tierId: tier.id,
      scope: null,
      mode: {
        kind: "game_pass",
        intentToken: await holdGamePass(event.id, tier.id, user.id),
      },
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    // A second claim. The buyer still owns the pass - they always will, which is
    // exactly why this cannot be allowed to mint a second ticket. A fresh intent,
    // because the first one was spent: this is the "they came back and pressed it
    // again" case, not a replayed request.
    const second = await issueTicket({
      eventId: event.id,
      holder: { userId: user.id },
      tierId: tier.id,
      scope: null,
      mode: {
        kind: "game_pass",
        intentToken: await holdGamePass(event.id, tier.id, user.id),
      },
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    expect(second.ticketId).toBe(first.ticketId);
    expect(second.existing).toBe(true);

    // `gp:<passId>:<robloxId>` rides the same unique constraint ProcessReceipt uses.
    const payments = await prisma.ticketPurchase.count({
      where: { purchaseId: `gp:${tier.gamePassId}:${user.robloxId}` },
    });
    expect(payments).toBe(1);

    const tickets = await prisma.ticket.count({ where: { eventId: event.id } });
    expect(tickets).toBe(1);
  });

  it("keys the payment by pass AND buyer, so two people can each buy one", async () => {
    owns();
    const event = await makeEvent({ capacity: 0 });
    const tier = await makeGamePassTier(event.id);
    const a = await makeUser();
    const b = await makeUser();

    for (const u of [a, b]) {
      const out = await issueTicket({
        eventId: event.id,
        holder: { userId: u.id },
        tierId: tier.id,
        scope: null,
        mode: {
          kind: "game_pass",
          intentToken: await holdGamePass(event.id, tier.id, u.id),
        },
      });
      expect(out.ok).toBe(true);
    }

    // If the key were the pass alone, the second buyer would have been handed the
    // first buyer's ticket - the failure this test exists to catch.
    expect(await prisma.ticket.count({ where: { eventId: event.id } })).toBe(2);
  });
});

// ---------------------------------------------------------------------------
describe("the three-state answer", () => {
  it("does not issue when Roblox says they do not own it", async () => {
    ownsNot();
    const event = await makeEvent({ capacity: 0 });
    const tier = await makeGamePassTier(event.id);
    const user = await makeUser();

    const out = await issueTicket({
      eventId: event.id,
      holder: { userId: user.id },
      tierId: tier.id,
      scope: null,
      mode: {
        kind: "game_pass",
        intentToken: await holdGamePass(event.id, tier.id, user.id),
      },
    });

    expect(out.ok).toBe(false);
    // "not yet" - the checkout polls on this. It is not an error state.
    if (!out.ok) expect(out.reason).toBe("not_paid");
    expect(await prisma.ticket.count({ where: { eventId: event.id } })).toBe(0);
    expect(await prisma.ticketPurchase.count()).toBe(0);
  });

  it("keeps 'could not ask' apart from 'did not pay'", async () => {
    const event = await makeEvent({ capacity: 0 });
    const tier = await makeGamePassTier(event.id);
    const user = await makeUser();

    // A revoked or never-granted consent. The fix is a button, so it must arrive as
    // its own reason - telling somebody 500 Robux down that they did not pay is the
    // single worst sentence this system could produce.
    cannotAsk("no_grant");
    const denied = await issueTicket({
      eventId: event.id,
      holder: { userId: user.id },
      tierId: tier.id,
      scope: null,
      mode: {
        kind: "game_pass",
        intentToken: await holdGamePass(event.id, tier.id, user.id),
      },
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.reason).toBe("needs_consent");

    // Roblox is down. The fix is waiting. Change nothing.
    cannotAsk("unavailable");
    const down = await issueTicket({
      eventId: event.id,
      holder: { userId: user.id },
      tierId: tier.id,
      scope: null,
      mode: {
        kind: "game_pass",
        intentToken: await holdGamePass(event.id, tier.id, user.id),
      },
    });
    expect(down.ok).toBe(false);
    if (!down.ok) expect(down.reason).toBe("verify_unavailable");

    // Neither one charged anybody or issued anything.
    expect(await prisma.ticket.count({ where: { eventId: event.id } })).toBe(0);
    expect(await prisma.ticketPurchase.count()).toBe(0);
  });

  it("refuses a claim with no hold behind it", async () => {
    owns();
    const event = await makeEvent({ capacity: 0 });
    const tier = await makeGamePassTier(event.id);
    const user = await makeUser();

    const out = await issueTicket({
      eventId: event.id,
      holder: { userId: user.id },
      tierId: tier.id,
      scope: null,
      mode: { kind: "game_pass", intentToken: "not-a-real-token" },
    });

    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("bad_intent");
  });
});

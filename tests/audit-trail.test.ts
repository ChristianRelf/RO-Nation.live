import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, makeUser, makeEvent } from "./helpers";

// The universal audit trail (lib/audit.ts, model AuditLog).
//
// Three things are under test, and they fail in three very different ways:
//
//   1. SCOPE. An audit row in the wrong scope is not a cosmetic bug - readableScopes()
//      is what decides who can read it, so a partner's write landing under "shasha"
//      shows one org's history to another's crew. Asserted against the database.
//
//   2. THE ZERO-ROW WRITE. Every scoped write here is an updateMany/deleteMany matched
//      on { id, partnerId }, which affects nothing when the id belongs to somebody
//      else. The audit call is gated on that count. A row claiming somebody revoked a
//      key they never touched is a false accusation with a timestamp on it, and it
//      would be indistinguishable from a real one forever after.
//
//   3. THE DOUBLE SCAN. redeemTicket returns the unchanged result for an
//      already-checked-in ticket, so a door that audited on `result.ticket` alone
//      would write a check-in line every time somebody re-scanned - inventing
//      attendances that never happened, at exactly the event the door exists to refuse.

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

class Redirect extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));

// The guards are not under test - each has its own file and its own reasons, and
// standing them up would mean a Roblox group-rank lookup over the network per test.
// What IS under test is what the actions do *after* a guard has said yes.
const { scopeMock } = vi.hoisted(() => ({ scopeMock: vi.fn() }));
vi.mock("@/lib/portal-scope", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/portal-scope")>();
  return { ...real, requireScopeManager: scopeMock, requireScopeUser: scopeMock };
});
vi.mock("@/lib/company", () => ({
  requireCompanyUser: async () => ({
    robloxId: "999",
    displayName: "Test Staff",
    username: "teststaff",
    rank: 250,
    roleName: "Test",
  }),
}));

// No webhook is configured in the suite so notify() is already a no-op, but an
// `announce: true` call site must not depend on that to stay off the network.
vi.mock("@/lib/notify", () => ({ notify: vi.fn(async () => {}) }));

const { recordAudit, findAudit, scopeFromPartnerId, COMPANY_SCOPE } =
  await import("@/lib/audit");
const { createApiKey, revokeApiKey } = await import("@/app/actions/api-keys");
const { doorRedeem } = await import("@/app/actions/door");

/** The shape requireScopeManager/requireScopeUser hand back, for one org. */
function actorFor(scopeId: string) {
  const isShasha = scopeId === "shasha";
  return {
    scope: {
      id: scopeId,
      name: isShasha ? "SHASHA" : "Sleep Token",
      basePath: isShasha ? "/shasha" : `/${scopeId}`,
      routeBase: isShasha ? "/shasha" : `/pp/${scopeId}`,
      // The whole point: SHASHA's non-roster tables are NULL, a partner's are the slug.
      eventScope: isShasha ? null : scopeId,
    },
    actor: { robloxId: "999", displayName: "Test Staff" },
    canWrite: true,
  };
}

async function resetAudit() {
  await prisma.auditLog.deleteMany();
  await prisma.apiKey.deleteMany();
}

beforeEach(async () => {
  await resetDb();
  await resetAudit();
  scopeMock.mockReset();
});

// ---------------------------------------------------------------- scope mapping

describe("scopeFromPartnerId", () => {
  it("maps RNL's NULL onto SHASHA, and a partner onto itself", () => {
    // NULL is what Event.partnerId carries for RNL's own, and on the portal RNL's
    // own is SHASHA - so an RNL show's history sits with RNL's roster history.
    expect(scopeFromPartnerId(null)).toBe("shasha");
    expect(scopeFromPartnerId(undefined)).toBe("shasha");
    expect(scopeFromPartnerId("sleeptokenro")).toBe("sleeptokenro");
  });

  it("is not the same thing as COMPANY_SCOPE", () => {
    // A survey has no partnerId column at all and belongs to the company; an RNL
    // event has one, and it is NULL. Collapsing the two would put a show's history
    // somewhere only rank-245+ can read it.
    expect(scopeFromPartnerId(null)).not.toBe(COMPANY_SCOPE);
  });
});

// ---------------------------------------------------------------- reads

describe("findAudit", () => {
  it("returns only the scopes asked for", async () => {
    const base = {
      action: "CREATED" as const,
      target: "ROSTER_ENTRY" as const,
      targetName: "someone",
      actor: { id: "1", name: "Tester" },
      summary: "did a thing",
    };
    await recordAudit({ ...base, scope: "shasha" });
    await recordAudit({ ...base, scope: "sleeptokenro" });
    await recordAudit({ ...base, scope: COMPANY_SCOPE });

    const partnerOnly = await findAudit(["sleeptokenro"], { take: 50 });
    expect(partnerOnly).toHaveLength(1);
    expect(partnerOnly[0].scope).toBe("sleeptokenro");

    const both = await findAudit(["shasha", COMPANY_SCOPE], { take: 50 });
    expect(both.map((r) => r.scope).sort()).toEqual(["company", "shasha"]);
  });

  it("returns nothing for somebody who holds no doors", async () => {
    // An empty scope list is a legitimate input, not an error - and it must not
    // degrade into "no filter", which would be every org's history at once.
    await recordAudit({
      scope: "shasha",
      action: "CREATED",
      target: "ROSTER_ENTRY",
      targetName: "someone",
      actor: { id: "1", name: "Tester" },
      summary: "did a thing",
    });
    expect(await findAudit([], { take: 50 })).toHaveLength(0);
  });

  it("can exclude a target, which is how /audit avoids double-reporting", async () => {
    const base = {
      scope: "shasha",
      action: "CREATED" as const,
      actor: { id: "1", name: "Tester" },
      summary: "did a thing",
    };
    await recordAudit({ ...base, target: "ROSTER_ENTRY", targetName: "a" });
    await recordAudit({ ...base, target: "API_KEY", targetName: "b" });

    const rest = await findAudit(["shasha"], {
      take: 50,
      target: { not: "ROSTER_ENTRY" },
    });
    expect(rest).toHaveLength(1);
    expect(rest[0].target).toBe("API_KEY");
  });
});

// ---------------------------------------------------------------- never throws

describe("recordAudit", () => {
  it("swallows a write failure rather than failing the act that succeeded", async () => {
    // The act already happened. A ticket is checked in, a key is minted - and the
    // person in front of you cannot do anything about our database. Same rule as
    // notify().
    //
    // The failure is a REAL one rather than a mock: a NUL byte is not representable
    // in a Postgres text column, so this insert genuinely cannot land. (Do not be
    // tempted to vi.spyOn(prisma.auditLog, "create") instead - Prisma builds its
    // model delegates lazily behind a proxy, and spying on one leaves it broken for
    // every later test in the file, silently, with every audit assertion after it
    // passing for the wrong reason.)
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      recordAudit({
        scope: "shasha\u0000broken",
        action: "CREATED",
        target: "API_KEY",
        targetName: "k",
        actor: { id: "1", name: "Tester" },
        summary: "minted",
      }),
    ).resolves.toBeUndefined();

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();

    // Nothing was written, and nothing threw.
    expect(await prisma.auditLog.count()).toBe(0);
  });
});

// ---------------------------------------------------------------- API keys

describe("API key writes", () => {
  it("mints under the caller's own scope and records what it could do", async () => {
    scopeMock.mockResolvedValue(actorFor("sleeptokenro"));

    const fd = new FormData();
    fd.set("name", "stro-door-scanner");
    fd.append("scopes", "TICKETS_REDEEM");
    const result = await createApiKey("sleeptokenro", null, fd);
    expect(result).toMatchObject({ ok: true, name: "stro-door-scanner" });

    // The key itself carries the partner slug...
    const key = await prisma.apiKey.findFirstOrThrow();
    expect(key.partnerId).toBe("sleeptokenro");

    // ...and so does its history, with the scopes frozen into meta so "what could
    // that key do" survives the key being revoked and forgotten.
    const rows = await findAudit(["sleeptokenro"], { take: 10 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "CREATED",
      target: "API_KEY",
      targetName: "stro-door-scanner",
      targetId: key.id,
    });
    expect(rows[0].meta).toEqual({ scopes: ["TICKETS_REDEEM"] });

    // And emphatically not under SHASHA's.
    expect(await findAudit(["shasha"], { take: 10 })).toHaveLength(0);
  });

  it("mints SHASHA's keys against NULL, not the string", async () => {
    scopeMock.mockResolvedValue(actorFor("shasha"));

    const fd = new FormData();
    fd.set("name", "rnl-door");
    fd.append("scopes", "TICKETS_REDEEM");
    await createApiKey("shasha", null, fd);

    // The key's partnerId is NULL - the same NULL RNL's events carry, which is what
    // lets a key's org be compared to an event's with one equality...
    const key = await prisma.apiKey.findFirstOrThrow();
    expect(key.partnerId).toBeNull();

    // ...while its audit scope is the STRING, because that is the id namespace the
    // portal reads. The two spellings are the trap RosterScope.eventScope exists for.
    const rows = await findAudit(["shasha"], { take: 10 });
    expect(rows).toHaveLength(1);
    expect(rows[0].scope).toBe("shasha");
  });

  it("records a revoke, once, naming the key", async () => {
    scopeMock.mockResolvedValue(actorFor("sleeptokenro"));

    const mint = new FormData();
    mint.set("name", "doomed");
    mint.append("scopes", "EVENTS_READ");
    await createApiKey("sleeptokenro", null, mint);
    const key = await prisma.apiKey.findFirstOrThrow();

    const fd = new FormData();
    fd.set("id", key.id);
    await revokeApiKey("sleeptokenro", fd);

    expect((await prisma.apiKey.findFirstOrThrow()).revokedAt).not.toBeNull();

    const revokes = await findAudit(["sleeptokenro"], {
      take: 10,
      target: "API_KEY",
    });
    const revoked = revokes.filter((r) => r.action === "REVOKED");
    expect(revoked).toHaveLength(1);
    expect(revoked[0].targetName).toBe("doomed");

    // Idempotent: revoking again matches zero rows (revokedAt is already set), so
    // it must not append a second line saying it happened twice.
    await revokeApiKey("sleeptokenro", fd);
    const after = (await findAudit(["sleeptokenro"], { take: 10 })).filter(
      (r) => r.action === "REVOKED",
    );
    expect(after).toHaveLength(1);
  });

  // THE negative test. See note 2 at the top of this file.
  it("writes NOTHING when the key belongs to another org", async () => {
    // A key that is SHASHA's...
    scopeMock.mockResolvedValue(actorFor("shasha"));
    const mint = new FormData();
    mint.set("name", "rnls-key");
    mint.append("scopes", "EVENTS_READ");
    await createApiKey("shasha", null, mint);
    const key = await prisma.apiKey.findFirstOrThrow();
    await prisma.auditLog.deleteMany();

    // ...and a Sleep Token manager posting its id. The guard passes - they really
    // do manage Sleep Token - and the { id, partnerId } match is what refuses them.
    scopeMock.mockResolvedValue(actorFor("sleeptokenro"));
    const fd = new FormData();
    fd.set("id", key.id);
    await revokeApiKey("sleeptokenro", fd);

    // The key is untouched...
    expect((await prisma.apiKey.findFirstOrThrow()).revokedAt).toBeNull();
    // ...and no history was invented, in EITHER scope.
    expect(await prisma.auditLog.count()).toBe(0);
  });
});

// ---------------------------------------------------------------- the door

describe("the door", () => {
  async function ticketFor(partnerId: string | null) {
    const user = await makeUser();
    const event = await makeEvent();
    if (partnerId !== null) {
      await prisma.event.update({
        where: { id: event.id },
        data: { partnerId },
      });
    }
    const ticket = await prisma.ticket.create({
      data: {
        code: `T-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        eventId: event.id,
        userId: user.id,
        status: "RESERVED",
        tierName: "General Admission",
        priceRobux: 0,
      },
    });
    return { user, event, ticket };
  }

  it("records a check-in under the SHOW's scope, not the door's", async () => {
    // An RNL show worked from the SHASHA door. The scope comes from the event's
    // partnerId (NULL → "shasha"), never from which entrance the crew used.
    const { ticket } = await ticketFor(null);
    scopeMock.mockResolvedValue(actorFor("shasha"));

    const fd = new FormData();
    fd.set("scope", "shasha");
    fd.set("code", ticket.code);
    const state = await doorRedeem(null, fd);

    expect(state.state).toBe("result");
    const rows = await findAudit(["shasha"], { take: 10 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "CHECKED_IN",
      target: "TICKET",
      targetName: ticket.code,
    });
  });

  // See note 3 at the top of this file.
  it("does not record a second check-in when the same ticket is re-scanned", async () => {
    const { ticket } = await ticketFor(null);
    scopeMock.mockResolvedValue(actorFor("shasha"));

    const fd = new FormData();
    fd.set("scope", "shasha");
    fd.set("code", ticket.code);

    await doorRedeem(null, fd);
    const second = await doorRedeem(null, fd);

    // The door refuses the second scan - that is its entire job...
    expect(second.state).toBe("result");
    if (second.state === "result") {
      expect(second.result.admit).toBe(false);
      expect(second.result.reason).toBe("already_checked_in");
    }
    // ...and the trail says one person went in, because one person did.
    const rows = await findAudit(["shasha"], { take: 10 });
    expect(rows).toHaveLength(1);
  });

  it("records a partner's check-in under the partner", async () => {
    const { ticket } = await ticketFor("sleeptokenro");
    scopeMock.mockResolvedValue(actorFor("sleeptokenro"));

    const fd = new FormData();
    fd.set("scope", "sleeptokenro");
    fd.set("code", ticket.code);
    await doorRedeem(null, fd);

    expect(await findAudit(["sleeptokenro"], { take: 10 })).toHaveLength(1);
    expect(await findAudit(["shasha"], { take: 10 })).toHaveLength(0);
  });

  // The SHASHA door's reason for existing is that eventScope is NULL, which is what
  // RNL's events carry. The failure mode of getting that wrong is not an error - it
  // is a door that admits everybody, because `partnerId: undefined` in a Prisma
  // where clause means "no filter at all" rather than "RNL's". So it is asserted
  // from the outside: present another org's real, valid ticket and be refused.
  it("refuses another org's ticket at the SHASHA door", async () => {
    const { ticket } = await ticketFor("sleeptokenro");
    scopeMock.mockResolvedValue(actorFor("shasha"));

    const fd = new FormData();
    fd.set("scope", "shasha");
    fd.set("code", ticket.code);
    const state = await doorRedeem(null, fd);

    expect(state.state).toBe("result");
    if (state.state === "result") {
      expect(state.result.admit).toBe(false);
      // not_found, not "wrong_event": whether somebody else's ticket exists is
      // none of this door's business, and those are the same answer.
      expect(state.result.reason).toBe("not_found");
    }

    // Untouched, and no history invented in either scope.
    const after = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    expect(after.status).toBe("RESERVED");
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it("refuses RNL's ticket at a partner's door", async () => {
    // The same test in the other direction, because the NULL is only on one side
    // and a filter that is wrong one way is often right the other by accident.
    const { ticket } = await ticketFor(null);
    scopeMock.mockResolvedValue(actorFor("sleeptokenro"));

    const fd = new FormData();
    fd.set("scope", "sleeptokenro");
    fd.set("code", ticket.code);
    const state = await doorRedeem(null, fd);

    expect(state.state).toBe("result");
    if (state.state === "result") expect(state.result.admit).toBe(false);
    expect(await prisma.auditLog.count()).toBe(0);
  });
});

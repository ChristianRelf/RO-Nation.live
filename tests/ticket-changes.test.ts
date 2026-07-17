import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { diffTicketChange } from "@/lib/member-notify";
import { resetDb, makeUser, makeEvent } from "./helpers";

// The company tickets page: moving a ticket, voiding a ticket, and the notice each one
// raises. Two things are under test here and they fail in very different ways.
//
//   1. WHICH DIALOG. diffTicketChange is the only thing that decides whether a member gets
//      the celebration or the plain notice, and it is pure - so it is tested as a table.
//
//   2. THE CHAIR. Cancelling nulls seatKey, which is the only thing that frees a seat.
//      Getting it wrong is silent: nothing throws, nothing logs, the seat is simply gone
//      for the life of the show. So it is asserted against the database rather than trusted.

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// The real one throws a framework signal to unwind the render. A sentinel that carries the
// url is enough here, and lets a test assert WHERE an action decided to send somebody.
class Redirect extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));

// The guard is not what is under test - it has its own reasons and its own file. Standing it
// up here would mean a Roblox group-rank lookup over the network per test.
vi.mock("@/lib/company", () => ({
  requireCompanyUser: async () => ({
    robloxId: "999",
    displayName: "Test Staff",
    username: "teststaff",
    rank: 250,
    roleName: "Test",
  }),
}));

// Who the browser is, for the acknowledge tests at the bottom. vi.hoisted because vi.mock is
// lifted above every const in the file - the factory would otherwise close over a binding that
// does not exist yet.
const { sessionMock } = vi.hoisted(() => ({ sessionMock: vi.fn() }));
vi.mock("@/lib/session", () => ({ getUserSession: sessionMock }));

const { setTicketStatus, updateTicket, voidCompanyTicket } = await import(
  "@/app/actions/company"
);

/** Runs an action and hands back the url it redirected to. */
async function run(
  action: (fd: FormData) => Promise<unknown>,
  fields: Record<string, string>,
) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  try {
    await action(fd);
  } catch (err) {
    if (err instanceof Redirect) return err.url;
    throw err;
  }
  return null;
}

const tier = (
  eventId: string,
  name: string,
  sortOrder: number,
  priceRobux: number,
) =>
  prisma.ticketTier.create({
    data: { eventId, name, sortOrder, priceRobux, active: true },
  });

beforeEach(resetDb);

// ---------------------------------------------------------------------------
describe("diffTicketChange - which dialog the member gets", () => {
  const ctx = { eventTitle: "Neon Nights", tierOrder: ["ga", "vip", "front"] };

  it("calls a move UP the event's tier order an upgrade", () => {
    const notice = diffTicketChange(
      { tierId: "ga", tierName: "General Admission", priceRobux: 0 },
      { tierId: "vip", tierName: "VIP", priceRobux: 500 },
      ctx,
    );
    expect(notice?.kind).toBe("TICKET_UPGRADED");
    expect(notice?.title).toBe("You've been upgraded to VIP");
    // The two things a member actually wonders. Worth pinning: this copy is frozen onto the
    // row at write and has to still be true months later.
    expect(notice?.body).toContain("nothing to pay");
    expect(notice?.body).toContain("Neon Nights");
  });

  // THE case. A comp into a free VIP tier is the most upgrade-shaped thing the crew does, and
  // a price comparison calls it a lateral move: 0 R$ against the 0 R$ they already held. If
  // this ever goes red, somebody has "simplified" the rank rule back into a price rule.
  it("calls a FREE comp into a better tier an upgrade, not a lateral move", () => {
    const notice = diffTicketChange(
      { tierId: "ga", tierName: "General Admission", priceRobux: 0 },
      { tierId: "front", tierName: "Front Barrier", priceRobux: 0 },
      ctx,
    );
    expect(notice?.kind).toBe("TICKET_UPGRADED");
  });

  it("calls a move DOWN the order an ordinary update", () => {
    const notice = diffTicketChange(
      { tierId: "front", tierName: "Front Barrier", priceRobux: 500 },
      { tierId: "ga", tierName: "General Admission", priceRobux: 0 },
      ctx,
    );
    expect(notice?.kind).toBe("TICKET_UPDATED");
    expect(notice?.title).toContain("has changed");
  });

  it("says nothing at all when the tier did not move", () => {
    expect(
      diffTicketChange(
        { tierId: "vip", tierName: "VIP", priceRobux: 500 },
        { tierId: "vip", tierName: "VIP", priceRobux: 500 },
        ctx,
      ),
    ).toBeNull();
  });

  // A ticket whose tier was deleted out from under it (tierId is SetNull). There is no
  // position to rank, so the frozen price snapshot is the fallback.
  it("falls back to price when the old tier cannot be ranked", () => {
    const up = diffTicketChange(
      { tierId: null, tierName: "Old VIP", priceRobux: 100 },
      { tierId: "front", tierName: "Front Barrier", priceRobux: 500 },
      ctx,
    );
    expect(up?.kind).toBe("TICKET_UPGRADED");

    const down = diffTicketChange(
      { tierId: null, tierName: "Old VIP", priceRobux: 900 },
      { tierId: "ga", tierName: "General Admission", priceRobux: 0 },
      ctx,
    );
    expect(down?.kind).toBe("TICKET_UPDATED");
  });
});

// ---------------------------------------------------------------------------
describe("updateTicket", () => {
  it("re-snapshots the ticket and tells the holder they were upgraded", async () => {
    const user = await makeUser();
    const event = await makeEvent();
    const ga = await tier(event.id, "General Admission", 0, 0);
    const vip = await tier(event.id, "VIP", 1, 500);
    const ticket = await prisma.ticket.create({
      data: {
        code: `RN-${Date.now().toString(36).slice(-6).toUpperCase()}`,
        eventId: event.id,
        userId: user.id,
        tierId: ga.id,
        tierName: ga.name,
        priceRobux: 0,
      },
    });

    await run(updateTicket, { ticketId: ticket.id, tierId: vip.id });

    // The frozen snapshot moves WITH the ticket. This is the one act where that is correct -
    // what they hold is now a different thing, so the ticket has to say so.
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.tierId).toBe(vip.id);
    expect(after.tierName).toBe("VIP");
    expect(after.priceRobux).toBe(500);

    const notices = await prisma.memberNotification.findMany({
      where: { userId: user.id },
    });
    expect(notices).toHaveLength(1);
    expect(notices[0].kind).toBe("TICKET_UPGRADED");
    expect(notices[0].url).toBe(`/tickets/${ticket.id}`);
  });

  it("raises no notice when the tier did not actually move", async () => {
    const user = await makeUser();
    const event = await makeEvent();
    const ga = await tier(event.id, "General Admission", 0, 0);
    const ticket = await prisma.ticket.create({
      data: {
        code: `RN-${Date.now().toString(36).slice(-6).toUpperCase()}`,
        eventId: event.id,
        userId: user.id,
        tierId: ga.id,
        tierName: ga.name,
      },
    });

    await run(updateTicket, { ticketId: ticket.id, tierId: ga.id });

    expect(await prisma.memberNotification.count({ where: { userId: user.id } })).toBe(0);
  });

  // Scope. A Ticket has no partnerId of its own, so the guard travels through the event -
  // and passing the company guard is not the same as being allowed to touch the row.
  it("refuses a ticket on a partner's show", async () => {
    const user = await makeUser();
    const partnerEvent = await prisma.event.create({
      data: {
        slug: `p-${Date.now().toString(36)}`,
        title: "Someone else's show",
        description: "Not RNL's.",
        startsAt: new Date(Date.now() + 86400000),
        status: "PUBLISHED",
        partnerId: "sleep-token",
      },
    });
    const t = await tier(partnerEvent.id, "VIP", 1, 500);
    const ticket = await prisma.ticket.create({
      data: {
        code: `RN-${Date.now().toString(36).slice(-6).toUpperCase()}`,
        eventId: partnerEvent.id,
        userId: user.id,
        tierName: "General Admission",
      },
    });

    const url = await run(updateTicket, { ticketId: ticket.id, tierId: t.id });

    expect(url).toBe("/company/tickets");
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.tierName).toBe("General Admission");
    expect(after.tierId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("cancelling gives the chair back", () => {
  /** A ticket sitting in a specific chair on a seated show. */
  async function seatedTicket() {
    const user = await makeUser();
    const event = await prisma.event.create({
      data: {
        slug: `seated-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        title: "Seated Show",
        description: "A seated test event.",
        startsAt: new Date(Date.now() + 86400000),
        status: "PUBLISHED",
        seatMode: "SEAT",
      },
    });
    const ticket = await prisma.ticket.create({
      data: {
        code: `RN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        eventId: event.id,
        userId: user.id,
        seatKey: "A1-K12",
        sectionKey: "A1",
        seatLabel: "Section A1 · Row K · Seat 12",
      },
    });
    return { user, event, ticket };
  }

  // The bug this page was built next to. setTicketStatus was a third writer of the cancel
  // path and it did not null the seat - so one click of Cancel on the attendees page burned
  // the chair for the life of the show: @@unique([eventId, seatKey]) binds cancelled rows,
  // so a dead ticket went on owning a seat nobody was sitting in.
  it("setTicketStatus(CANCELLED) frees the seat", async () => {
    const { event, ticket } = await seatedTicket();

    await run(setTicketStatus, {
      ticketId: ticket.id,
      eventId: event.id,
      status: "CANCELLED",
    });

    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.status).toBe("CANCELLED");
    expect(after.seatKey).toBeNull();
    expect(after.sectionKey).toBeNull();
    // Frozen, and deliberately NOT cleared: the stub still says where they would have been
    // sitting. What they lose is the chair, not the memory of it.
    expect(after.seatLabel).toBe("Section A1 · Row K · Seat 12");

    // The actual point of all of the above - somebody else can now be sold that chair.
    const next = await makeUser();
    await expect(
      prisma.ticket.create({
        data: {
          code: `RN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          eventId: event.id,
          userId: next.id,
          seatKey: "A1-K12",
          sectionKey: "A1",
        },
      }),
    ).resolves.toBeTruthy();
  });

  it("checking in leaves the seat exactly where it is", async () => {
    const { event, ticket } = await seatedTicket();

    await run(setTicketStatus, {
      ticketId: ticket.id,
      eventId: event.id,
      status: "CHECKED_IN",
    });

    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.status).toBe("CHECKED_IN");
    expect(after.seatKey).toBe("A1-K12");
    expect(after.sectionKey).toBe("A1");
  });

  it("voidCompanyTicket frees the seat and tells the holder", async () => {
    const { user, event, ticket } = await seatedTicket();

    await run(voidCompanyTicket, { ticketId: ticket.id });

    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.status).toBe("CANCELLED");
    expect(after.seatKey).toBeNull();
    expect(after.revokedAt).toBeNull(); // a void is not a ban

    const notices = await prisma.memberNotification.findMany({
      where: { userId: user.id },
    });
    expect(notices).toHaveLength(1);
    expect(notices[0].kind).toBe("TICKET_UPDATED");
    // Not banned, so they are pointed at the show to take another.
    expect(notices[0].url).toBe(`/events/${event.slug}`);
  });
});

// ---------------------------------------------------------------------------
describe("voidCompanyTicket - banning", () => {
  async function liveTicket() {
    const user = await makeUser();
    const event = await makeEvent();
    const ticket = await prisma.ticket.create({
      data: {
        code: `RN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        eventId: event.id,
        userId: user.id,
      },
    });
    return { user, event, ticket };
  }

  it("records the ban, the reason and who did it", async () => {
    const { user, ticket } = await liveTicket();

    await run(voidCompanyTicket, {
      ticketId: ticket.id,
      ban: "true",
      reason: "Abusive in chat",
    });

    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.status).toBe("CANCELLED");
    expect(after.revokedAt).not.toBeNull();
    expect(after.revokedReason).toBe("Abusive in chat");
    // From the session, never the form.
    expect(after.revokedByName).toBe("Test Staff");

    const notices = await prisma.memberNotification.findMany({
      where: { userId: user.id },
    });
    // A banned holder is not invited to go and take a ticket the reserve path would refuse.
    expect(notices[0].url).toBeNull();
  });

  it("refuses to void a CHECKED_IN ticket", async () => {
    const { ticket } = await liveTicket();
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: "CHECKED_IN", checkedInAt: new Date() },
    });

    const url = await run(voidCompanyTicket, { ticketId: ticket.id });

    expect(url).toBe(`/company/tickets/${ticket.id}?error=checked_in`);
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.status).toBe("CHECKED_IN");
  });

  // Tightening an existing void into a ban must not pop a second "your ticket has been
  // cancelled" at somebody who read the first one last week.
  it("does not tell the holder twice when a void is upgraded to a ban", async () => {
    const { user, ticket } = await liveTicket();

    await run(voidCompanyTicket, { ticketId: ticket.id });
    expect(await prisma.memberNotification.count({ where: { userId: user.id } })).toBe(1);

    await run(voidCompanyTicket, { ticketId: ticket.id, ban: "true", reason: "Second thoughts" });

    expect(await prisma.memberNotification.count({ where: { userId: user.id } })).toBe(1);
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.revokedAt).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The cascade. An upgrade is shown alone and acknowledges only itself, so anything else
// waiting opens on the refresh behind it. Two ways that can go wrong: the upgrade eats the
// notices it did not show, or `ids` becomes a way to touch somebody else's rows.
describe("acknowledgeNotifications", () => {
  async function noticeFor(userId: string, kind: "TICKET_UPGRADED" | "EVENT_RESCHEDULED") {
    return prisma.memberNotification.create({
      data: { userId, kind, title: `${kind} notice` },
    });
  }

  it("marks only the ids it was given, leaving the rest to open behind it", async () => {
    const user = await makeUser();
    sessionMock.mockResolvedValue({
      uid: user.id,
      robloxId: user.robloxId,
      username: user.username,
      displayName: user.displayName,
    });

    const upgrade = await noticeFor(user.id, "TICKET_UPGRADED");
    const reschedule = await noticeFor(user.id, "EVENT_RESCHEDULED");

    const { acknowledgeNotifications } = await import("@/app/actions/notifications");
    await acknowledgeNotifications([upgrade.id]);

    expect(
      (await prisma.memberNotification.findUniqueOrThrow({ where: { id: upgrade.id } })).seenAt,
    ).not.toBeNull();
    // The one that matters most must survive the happiest one.
    expect(
      (await prisma.memberNotification.findUniqueOrThrow({ where: { id: reschedule.id } }))
        .seenAt,
    ).toBeNull();
  });

  it("cannot mark somebody else's notice seen, even given its id", async () => {
    const me = await makeUser();
    const them = await makeUser();
    sessionMock.mockResolvedValue({
      uid: me.id,
      robloxId: me.robloxId,
      username: me.username,
      displayName: me.displayName,
    });

    const theirs = await noticeFor(them.id, "TICKET_UPGRADED");

    const { acknowledgeNotifications } = await import("@/app/actions/notifications");
    await acknowledgeNotifications([theirs.id]);

    // `ids` can only ever NARROW the userId pin, never move it.
    expect(
      (await prisma.memberNotification.findUniqueOrThrow({ where: { id: theirs.id } })).seenAt,
    ).toBeNull();
  });

  it("marks everything unseen when given no ids (the ordinary modal)", async () => {
    const user = await makeUser();
    sessionMock.mockResolvedValue({
      uid: user.id,
      robloxId: user.robloxId,
      username: user.username,
      displayName: user.displayName,
    });

    await noticeFor(user.id, "EVENT_RESCHEDULED");
    await noticeFor(user.id, "TICKET_UPGRADED");

    const { acknowledgeNotifications } = await import("@/app/actions/notifications");
    await acknowledgeNotifications();

    expect(
      await prisma.memberNotification.count({ where: { userId: user.id, seenAt: null } }),
    ).toBe(0);
  });
});

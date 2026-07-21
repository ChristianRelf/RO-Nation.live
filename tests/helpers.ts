import { prisma } from "@/lib/db";

// Fixtures and cleanup for the DB-backed suite. Everything is RNL-scoped
// (partnerId null) and unseated unless a test says otherwise.

let seq = 0;
const uniq = () => `${Date.now().toString(36)}-${(seq += 1)}-${Math.floor(Math.random() * 1e9).toString(36)}`;

/** A unique all-digit id, in the shape Roblox actually issues. See makeUser(). */
const uniqDigits = () => `${Date.now()}${(seq += 1).toString().padStart(4, "0")}`;

/**
 * Wipe every table a ticketing test touches, in FK-safe order. Called in
 * beforeEach so each test starts from empty - the concurrency being tested has to
 * be created inside the test, never leaked in from the last one.
 */
export async function resetDb() {
  await prisma.ticketPurchase.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.purchaseIntent.deleteMany();
  await prisma.ticketTier.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
}

/**
 * `numericRobloxId` matters more than it looks.
 *
 * resolveUserId() (intents.ts, and its twin in issue.ts) validates the shape of a
 * Roblox id before it does anything else - `/^\d{1,20}$/` - so the default `t-<id>`
 * below is rejected out of hand and comes back as "no_player". That is invisible to
 * every test that identifies people by `{ userId }`, which is most of them, and it
 * bites the moment a test passes a robloxId instead: the refusal under test is never
 * reached, and the assertion fails somewhere that looks nothing like the cause.
 *
 * So: opt in wherever a fixture's robloxId actually crosses that boundary.
 */
export async function makeUser(opts: { numericRobloxId?: boolean } = {}) {
  const id = uniq();
  return prisma.user.create({
    data: {
      robloxId: opts.numericRobloxId ? uniqDigits() : `t-${id}`,
      username: `user-${id}`,
      displayName: `User ${id}`,
    },
  });
}

export async function makeEvent(opts: { capacity?: number; presale?: boolean } = {}) {
  const id = uniq();
  return prisma.event.create({
    data: {
      slug: `event-${id}`,
      title: `Event ${id}`,
      description: "A test event.",
      startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      capacity: opts.capacity ?? 0, // 0 = unlimited
      status: "PUBLISHED",
      presale: opts.presale ?? false,
      // seatMode defaults NONE, partnerId defaults null - RNL's own, unseated.
    },
  });
}

/** A paid tier sold on the Developer Product rail (the ProcessReceipt path). */
export async function makePaidTier(eventId: string) {
  const id = uniq();
  return prisma.ticketTier.create({
    data: {
      eventId,
      name: "General Admission",
      priceRobux: 100,
      devProductId: `dp-${id}`,
      active: true,
      sortOrder: 0,
    },
  });
}

/**
 * A paid tier sold on the GAME PASS rail (the roblox.com web path).
 *
 * gamePassId is `@unique` across the whole table - a pass may only ever buy one
 * tier - so it is generated per call rather than fixed. Two fixtures sharing a
 * literal would collide on the second test, and the failure would look like a
 * bug in the rail rather than in the fixture.
 */
export async function makeGamePassTier(eventId: string) {
  const id = uniq();
  return prisma.ticketTier.create({
    data: {
      eventId,
      name: "Front Row",
      priceRobux: 250,
      gamePassId: `gp-${id}`,
      active: true,
      sortOrder: 0,
    },
  });
}

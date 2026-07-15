import { prisma } from "@/lib/db";

// Fixtures and cleanup for the DB-backed suite. Everything is RNL-scoped
// (partnerId null) and unseated unless a test says otherwise.

let seq = 0;
const uniq = () => `${Date.now().toString(36)}-${(seq += 1)}-${Math.floor(Math.random() * 1e9).toString(36)}`;

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

export async function makeUser() {
  const id = uniq();
  return prisma.user.create({
    data: {
      robloxId: `t-${id}`,
      username: `user-${id}`,
      displayName: `User ${id}`,
    },
  });
}

export async function makeEvent(opts: { capacity?: number } = {}) {
  const id = uniq();
  return prisma.event.create({
    data: {
      slug: `event-${id}`,
      title: `Event ${id}`,
      description: "A test event.",
      startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      capacity: opts.capacity ?? 0, // 0 = unlimited
      status: "PUBLISHED",
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

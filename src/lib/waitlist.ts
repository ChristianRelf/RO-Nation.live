import { MemberNotificationKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { partnerOrigin } from "@/lib/partners/urls";

// The sold-out queue's one moving part: when a seat frees, tell the next person.
//
// Called from the TWO seat-freeing writers - voidTicket() in lib/tickets/issue.ts
// (which serves the API's void and revoke) and cancelTicket() in
// actions/tickets.ts (a member's own cancel). Both null a seatKey to give the chair
// back; this is what turns that freed chair into a notification.
//
// Not server-only, so a test can drive it directly; it takes no secrets and leans
// only on the shared prisma client, like lib/reminders.ts.

/**
 * Tell the oldest un-notified waiter that a spot opened on `eventId`.
 *
 * A no-op when nobody is waiting (the common case - most cancellations are on shows
 * that were never full). Idempotent under a race: the notifiedAt stamp is CLAIMED
 * with a guarded update, so two seats freeing at the same instant notify two
 * different waiters rather than the same one twice.
 *
 * Returns whether a waiter was notified, mostly for tests.
 */
export async function notifyNextWaiter(eventId: string): Promise<boolean> {
  // Bounded loop, because the oldest waiter may be stale (already got a ticket
  // another way) or claimed by a racing seat-free. Each pass either notifies
  // somebody and returns, or drops/skips a row and tries the next. Five is far more
  // than any real queue burns through between one freed seat and its taker.
  for (let attempt = 0; attempt < 5; attempt++) {
    const waiter = await prisma.waitlist.findFirst({
      where: { eventId, notifiedAt: null },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        userId: true,
        event: { select: { slug: true, title: true, partnerId: true } },
      },
    });
    if (!waiter) return false;

    // Already in some other way - a game-issued ticket, a gift. Notifying them a
    // spot opened would be nonsense, so drop the stale row and move to the next.
    const holds = await prisma.ticket.findFirst({
      where: { eventId, userId: waiter.userId, status: { not: "CANCELLED" } },
      select: { id: true },
    });
    if (holds) {
      await prisma.waitlist.delete({ where: { id: waiter.id } });
      continue;
    }

    // Claim the row. A loser (another freed seat racing this one) updates zero rows;
    // try the next waiter rather than notifying nobody.
    const claim = await prisma.waitlist.updateMany({
      where: { id: waiter.id, notifiedAt: null },
      data: { notifiedAt: new Date() },
    });
    if (claim.count === 0) continue;

    // Absolute for a partner show (read on ronation.live, where a relative link
    // would 404 under RNL's scope); relative for RNL's. Same rule as other notices.
    const url = waiter.event.partnerId
      ? `${partnerOrigin(waiter.event.partnerId)}/events/${waiter.event.slug}`
      : `/events/${waiter.event.slug}`;

    await prisma.memberNotification.create({
      data: {
        userId: waiter.userId,
        eventId,
        kind: MemberNotificationKind.WAITLIST_OFFER,
        title: `A spot opened for ${waiter.event.title}`,
        body: "Someone gave up their place. Grab a ticket now - first come, first served, so it may not last.",
        url,
      },
    });
    return true;
  }
  return false;
}

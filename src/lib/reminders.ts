import { EventStatus, MemberNotificationKind, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { partnerOrigin } from "@/lib/partners/urls";
import { formatDateTime } from "@/lib/format";

// "Doors soon" - the nudge a ticket-holder gets the day before a show.
//
// Deliberately NOT server-only, and it takes no secrets: it is called from both
// the cron script (scripts/remind.ts) and could be from an API route, so it leans
// only on the shared prisma client and pure helpers. The one thing it must get
// right is sending each reminder EXACTLY once, and that is what reminderSentAt and
// the claim below are for - see the field's note in schema.prisma.
//
// Holders only, not followers. A reminder is for the people who are coming; a
// follower who never took a ticket is still deciding, and "doors soon" to them is
// pressure, not a service. The change-notice fan-out (notifyEventAudience) reaches
// both because a cancellation concerns both; this does not, because it does not.

/** How far ahead of a show the reminder goes out. */
export const REMINDER_WINDOW_HOURS = 24;

const HOUR = 60 * 60 * 1000;

/** The notice text, frozen onto every row at write - so a later edit cannot rewrite it. */
export function reminderNotice(title: string, startsAt: Date) {
  return {
    title: `${title} is coming up`,
    body: `${title} starts ${formatDateTime(startsAt)}. Your ticket is in your wallet - see you there.`,
  };
}

export type ReminderResult = { shows: number; notices: number };

/**
 * Fan a reminder out to the holders of every published show now inside the window.
 *
 * Idempotent by construction. Each show is CLAIMED with a guarded update
 * (reminderSentAt: null → now) before any notice is written, and only the claimer
 * proceeds - so a second run, or two sweeps racing, settle on exactly one reminder
 * per show. A show already claimed matches `count === 0` and is skipped.
 */
export async function sendDueReminders(now: Date = new Date()): Promise<ReminderResult> {
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_HOURS * HOUR);

  const due = await prisma.event.findMany({
    where: {
      status: EventStatus.PUBLISHED,
      reminderSentAt: null,
      // Inside the window and not already past - a show that started an hour ago
      // does not need reminding, it needs the door.
      startsAt: { gte: now, lte: windowEnd },
    },
    select: { id: true, title: true, slug: true, partnerId: true, startsAt: true },
  });

  let shows = 0;
  let notices = 0;

  for (const ev of due) {
    // The claim. Whoever flips reminderSentAt from null owns the fan-out; a loser
    // (another sweep, a re-run) gets count 0 and moves on, having sent nothing.
    const claim = await prisma.event.updateMany({
      where: { id: ev.id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (claim.count === 0) continue;
    shows++;

    const holders = await prisma.ticket.findMany({
      where: { eventId: ev.id, status: { not: TicketStatus.CANCELLED } },
      select: { userId: true },
    });
    const userIds = [...new Set(holders.map((h) => h.userId))];
    if (!userIds.length) continue;

    // Absolute for a partner show (the member reads this on ronation.live, where a
    // relative /events/<slug> would 404 under RNL's own scope); relative for RNL's.
    const url = ev.partnerId
      ? `${partnerOrigin(ev.partnerId)}/events/${ev.slug}`
      : `/events/${ev.slug}`;
    const notice = reminderNotice(ev.title, ev.startsAt);

    await prisma.memberNotification.createMany({
      data: userIds.map((userId) => ({
        userId,
        eventId: ev.id,
        kind: MemberNotificationKind.EVENT_REMINDER,
        title: notice.title,
        body: notice.body,
        url,
      })),
    });
    notices += userIds.length;
  }

  return { shows, notices };
}

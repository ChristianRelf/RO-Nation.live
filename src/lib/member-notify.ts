import "server-only";
import type { Event } from "@prisma/client";
import { MemberNotificationKind } from "@prisma/client";
import { prisma } from "./db";
import { formatDateTime } from "./format";
import { partnerOrigin } from "./partners/urls";

// Telling the people who care when a show changes under them.
//
// The whole point: a member holding a ticket to a show that gets rescheduled or cancelled
// must not learn it at the (wrong) door. So the four event write actions - updateEvent,
// deleteEvent and their partner twins - run a diff and fan a notice out to everyone affected.
//
// Two rules shape every line below:
//
//   • The audience is anyone holding a live ticket OR following the show. Both are read
//     from the database at the moment of the change - which is why, for a DELETE (where
//     Ticket and EventFollow cascade away with the event), the fan-out MUST run before the
//     delete, not after. notifyEventAudience is written to be awaited in that order.
//
//   • The notice TEXT is frozen at write. The event may be edited again, or deleted, and the
//     line "Neon Nights was rescheduled to Saturday" has to still say Saturday. Same reason
//     Ticket.tierName is a snapshot and not a join. eventId is SetNull for the same reason:
//     a "this show was cancelled" notice has to outlive the show.

/** The subset of an edit this cares about - what readEventForm(content.ts) returns. */
type EventChangeInput = {
  title: string;
  startsAt: Date | null;
  doorsAt: Date | null;
  venue: string | null;
  placeUrl: string | null;
  status: string; // EventStatus
};

export type MemberNotice = {
  kind: MemberNotificationKind;
  title: string;
  body: string | null;
};

const sameTime = (a: Date | null, b: Date | null) =>
  (a?.getTime() ?? null) === (b?.getTime() ?? null);

/** The notice a cancellation raises - shared by the archive path and the delete path. */
export function cancelledNotice(title: string): MemberNotice {
  return {
    kind: MemberNotificationKind.EVENT_CANCELLED,
    title: `${title} has been cancelled`,
    body: "This show has been called off. Any ticket you were holding for it is now void.",
  };
}

/**
 * What, if anything, is worth telling a member about this edit. Returns null for the common
 * case - a description tweak, a thumbnail swap, an edit to a DRAFT nobody can see - so the
 * caller only fans out when there is genuinely something to say.
 *
 * A DRAFT show has no audience (you cannot hold or follow one), so unless the row is or was
 * PUBLISHED there is nothing here to raise.
 */
export function diffEventChange(
  before: Event,
  after: EventChangeInput,
): MemberNotice | null {
  if (before.status !== "PUBLISHED" && after.status !== "PUBLISHED") return null;

  const name = after.title || before.title;

  // Pulled from sale: a published show archived. Treated as a cancellation - to a
  // ticket-holder that is exactly what it is.
  if (before.status === "PUBLISHED" && after.status === "ARCHIVED") {
    return cancelledNotice(name);
  }

  // Rescheduled: start time or doors moved.
  if (
    !sameTime(before.startsAt, after.startsAt) ||
    !sameTime(before.doorsAt, after.doorsAt)
  ) {
    const when = after.startsAt ?? before.startsAt;
    return {
      kind: MemberNotificationKind.EVENT_RESCHEDULED,
      title: `${name} has been rescheduled`,
      body: `New time: ${formatDateTime(when)} (was ${formatDateTime(before.startsAt)}).`,
    };
  }

  // Moved: a new in-experience venue or place link.
  if (
    (before.venue ?? "") !== (after.venue ?? "") ||
    (before.placeUrl ?? "") !== (after.placeUrl ?? "")
  ) {
    return {
      kind: MemberNotificationKind.EVENT_VENUE,
      title: `${name} has a new venue`,
      body: after.venue
        ? `New venue: ${after.venue}.`
        : "The venue for this show has changed - check the event page for details.",
    };
  }

  return null;
}

/**
 * Fan a notice out to everyone affected by a change to `event`.
 *
 * MUST be awaited before a delete: for a cancellation-by-delete the tickets and follows that
 * define the audience are about to cascade away, so pass `{ deleted: true }` and call this
 * FIRST. For an in-place edit the order does not matter and callers may `void` it.
 *
 * Never throws: a failed notification must not turn a saved edit into an error for the staff
 * member who made it. Same contract as notify().
 */
export async function notifyEventAudience(
  event: { id: string; slug: string; partnerId: string | null },
  notice: MemberNotice,
  opts: { deleted?: boolean } = {},
): Promise<void> {
  try {
    const [holders, followers] = await Promise.all([
      prisma.ticket.findMany({
        where: { eventId: event.id, status: { not: "CANCELLED" } },
        select: { userId: true },
      }),
      prisma.eventFollow.findMany({
        where: { eventId: event.id },
        select: { userId: true },
      }),
    ]);

    const userIds = [
      ...new Set([...holders, ...followers].map((r) => r.userId)),
    ];
    if (userIds.length === 0) return;

    // A cancelled or deleted show has no live page to point at. Otherwise link to the event -
    // absolute for a partner (a relative /events/<slug> 404s under RNL's own scope), relative
    // for RNL's own.
    const url =
      opts.deleted || notice.kind === "EVENT_CANCELLED"
        ? null
        : event.partnerId
          ? `${partnerOrigin(event.partnerId)}/events/${event.slug}`
          : `/events/${event.slug}`;

    await prisma.memberNotification.createMany({
      data: userIds.map((userId) => ({
        userId,
        // A delete is about to remove the event; keep the notice by detaching it now.
        eventId: opts.deleted ? null : event.id,
        kind: notice.kind,
        title: notice.title,
        body: notice.body,
        url,
      })),
    });
  } catch (err) {
    // Swallow, like notify(): the edit succeeded, and a missed notice is not worth failing it.
    console.error("notifyEventAudience failed", err);
  }
}

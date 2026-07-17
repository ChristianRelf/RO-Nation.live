import "server-only";
import type { Event } from "@prisma/client";
import { MemberNotificationKind } from "@prisma/client";
import { prisma } from "./db";
import { formatDateTime } from "./format";
import { partnerOrigin } from "./partners/urls";

// Telling the people who care when something changes under them.
//
// The whole point: a member holding a ticket to a show that gets rescheduled or cancelled
// must not learn it at the (wrong) door. So the four event write actions - updateEvent,
// deleteEvent and their partner twins - run a diff and fan a notice out to everyone affected.
//
// Two halves, in this order: the EVENT half (a broadcast - one change, every holder and
// follower) and the TICKET half further down (one member, because their own row was edited
// on the company tickets page). They share the MemberNotice shape and both rules below.
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

// ---- One ticket, one person ----------------------------------------------
//
// Everything above is a BROADCAST: one edit to a show, fanned out to everyone holding or
// following it. Everything below is addressed to a single member, because somebody edited
// THEIR row on the company tickets page.
//
// Same two rules apply - the audience is read at the moment of the change, and the text is
// frozen at write - but the interesting question here is a different one: which of the two
// dialogs does this open?

/** The part of a ticket a company edit can move. Read before the write, and after. */
export type TicketSnapshot = {
  tierId: string | null;
  tierName: string | null;
  priceRobux: number;
};

const tierNameOf = (t: TicketSnapshot) => t.tierName ?? "General Admission";

/**
 * What to tell the holder that their ticket changed - and, in the `kind` it returns, WHICH
 * dialog that becomes. TICKET_UPGRADED opens the celebration; TICKET_UPDATED opens the
 * ordinary notice. This function is the only thing that decides between them.
 *
 * ---- What makes a move an UPGRADE -----------------------------------------
 *
 * The event's own tier order, not the price. `tierOrder` is the ids from effectiveTiers()
 * (pricing.ts) - sortOrder, then price - which is the order the member was already shown at
 * the checkout. Moving to a tier further down that list is an upgrade.
 *
 * Price is the tempting rule and it is the wrong one: comping somebody into VIP is the most
 * upgrade-shaped thing the crew ever does, and a free VIP tier is 0 R$ against the 0 R$ they
 * already held - so a price test calls the happiest edit on this page a lateral move and
 * shows them a shrug. Ranking against the event's own list gets it right, and it costs one
 * indexOf.
 *
 * The fallback exists for the one case the list cannot rank: a ticket whose tier was DELETED
 * out from under it (tierId is SetNull) or which predates the tiers table entirely. There is
 * no position to compare, so the frozen `priceRobux` snapshot is all that is left to ask -
 * which is imperfect, and is exactly why it is the fallback and not the rule.
 */
export function diffTicketChange(
  before: TicketSnapshot,
  after: TicketSnapshot,
  ctx: { eventTitle: string; tierOrder: readonly string[] },
): MemberNotice | null {
  const was = tierNameOf(before);
  const now = tierNameOf(after);

  // Nothing a member would notice. Re-picking the tier they already hold is a no-op, and a
  // no-op must not pop a dialog at them.
  if (before.tierId === after.tierId && was === now) return null;

  const rankOf = (t: TicketSnapshot) =>
    t.tierId ? ctx.tierOrder.indexOf(t.tierId) : -1;
  const [wasRank, nowRank] = [rankOf(before), rankOf(after)];

  const upgraded =
    wasRank >= 0 && nowRank >= 0
      ? nowRank > wasRank
      : after.priceRobux > before.priceRobux;

  if (upgraded) {
    return {
      kind: MemberNotificationKind.TICKET_UPGRADED,
      title: `You've been upgraded to ${now}`,
      // No "congratulations" and no exclamation mark: the dialog is doing the celebrating,
      // and this line still has to read sensibly in the flat list on the account hub months
      // later. What it says instead is the thing they will actually wonder - do I owe
      // anything, and is my ticket still my ticket.
      body: `Your ticket for ${ctx.eventTitle} was ${was}. It's now ${now} - same ticket, same code, nothing to pay.`,
    };
  }

  return {
    kind: MemberNotificationKind.TICKET_UPDATED,
    title: `Your ticket for ${ctx.eventTitle} has changed`,
    body: `Your admission is now ${now} (was ${was}). Your ticket code is unchanged.`,
  };
}

/**
 * The notice a void raises.
 *
 * A cancelled ticket that says nothing to its holder is the exact failure this whole module
 * exists to prevent - they find out at the door, which is the one place nobody can fix it.
 *
 * The banned wording is deliberately plainer and does not invite them to reserve again, since
 * the reserve path would refuse them (issueTicket() reads revokedAt and stops). Telling
 * somebody to go and take a ticket that the database will not give them is worse than saying
 * nothing.
 */
export function ticketVoidedNotice(
  eventTitle: string,
  banned: boolean,
): MemberNotice {
  return {
    kind: MemberNotificationKind.TICKET_UPDATED,
    title: `Your ticket for ${eventTitle} has been cancelled`,
    body: banned
      ? "This ticket has been cancelled and will not get you in. If you think that's a mistake, get in touch with us before the day."
      : "This ticket is no longer valid. You're free to reserve another one for this show.",
  };
}

/**
 * Tell one holder about one ticket.
 *
 * Never throws, exactly like notifyEventAudience: the edit succeeded, and a missed notice is
 * not worth turning a saved change into an error for the staff member who made it.
 *
 * The default url is the ticket itself. That is a RELATIVE link, so this is only correct for
 * RNL's own shows - which is all the company tickets page can reach (every read and write
 * there is pinned to `partnerId: null`). A partner surface calling this would need
 * partnerOrigin(), the same way the fan-out above does.
 */
export async function notifyTicketHolder(
  ticket: { id: string; userId: string; eventId: string },
  notice: MemberNotice,
  opts: { url?: string | null } = {},
): Promise<void> {
  try {
    await prisma.memberNotification.create({
      data: {
        userId: ticket.userId,
        eventId: ticket.eventId,
        kind: notice.kind,
        title: notice.title,
        body: notice.body,
        url: opts.url === undefined ? `/tickets/${ticket.id}` : opts.url,
      },
    });
  } catch (err) {
    console.error("notifyTicketHolder failed", err);
  }
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

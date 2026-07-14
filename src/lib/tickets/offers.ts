import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { partnerBySlug } from "@/lib/partners/registry";
import type { EventWithCount } from "@/lib/queries";
import {
  buildOffers,
  effectiveTiers,
  robuxSalesAllowed,
  type TierOffer,
} from "./pricing";

/**
 * What's actually on sale for an event, resolved against live ticket counts.
 *
 * The one place the Robux master switch is read for *display*. It is read again,
 * independently, in app/actions/tickets.ts - the action does not trust this, and
 * must not: this decides what a visitor is shown, and that is not the same job
 * as deciding what may be issued.
 */
export async function offersForEvent(
  event: Pick<EventWithCount, "id" | "partnerId" | "capacity" | "ticketsCount">,
): Promise<TierOffer[]> {
  const [tiers, sold] = await Promise.all([
    prisma.ticketTier.findMany({ where: { eventId: event.id } }),
    prisma.ticket.groupBy({
      by: ["tierId"],
      where: { eventId: event.id, status: { not: "CANCELLED" } },
      _count: { _all: true },
    }),
  ]);

  // A ticket on the implicit tier has a NULL tierId; the map keys it on "", the
  // same string the implicit tier's radio submits.
  const soldPerTier = new Map(
    sold.map((g) => [g.tierId ?? "", g._count._all] as const),
  );

  return buildOffers({
    tiers: effectiveTiers(tiers),
    soldPerTier,
    eventRemaining:
      event.capacity > 0
        ? Math.max(0, event.capacity - event.ticketsCount)
        : null,
    robuxAllowed: robuxSalesAllowed(
      partnerBySlug(event.partnerId),
      env.robuxTickets,
    ),
  });
}

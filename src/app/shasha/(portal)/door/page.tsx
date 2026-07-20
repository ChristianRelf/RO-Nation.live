import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireScopeUser, SHASHA_SCOPE } from "@/lib/portal-scope";
import { DoorCheck } from "@/components/ticket/door-check";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Door" };

// portal.ronation.live/shasha/door - the manual door for RNL's own shows.
//
// The same shows as /company/door, and the same code path down to the letter
// (lib/tickets/verify.ts) - so the two can never disagree about whether somebody
// gets in. What differs is who may stand at it.
//
// READ TIER, deliberately. Working the door IS the read-only member's job, and
// /company refuses anybody under rank 245 - so before this page existed, the
// people most likely to be standing at an entrance with a laptop were the ones
// who could not open the tool for it. The same argument the partner door has
// always made, finally applied to RNL's own crew. See authorise() in
// app/actions/door.ts.
//
// Guarded HERE as well as in the action: a page guard does not protect a POST.

export default async function ShashaDoorPage() {
  const { scope } = await requireScopeUser(SHASHA_SCOPE);

  // Shows worth having on a door tonight: RNL's own, published, and not long past.
  // Yesterday's is still listed, because a door is often worked the morning after
  // to reconcile who actually came.
  //
  // scope.eventScope is NULL here, which is what RNL's events carry - the string
  // "shasha" would match nothing. See RosterScope.eventScope.
  const events = await prisma.event.findMany({
    where: {
      partnerId: scope.eventScope,
      status: "PUBLISHED",
      startsAt: { gt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, title: true },
    take: 20,
  });

  return (
    <div>
      <div className="mb-8 border-b border-line pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
          RO. Nation LIVE
        </p>
        <h1 className="display mt-3 text-5xl">Door</h1>
        <p className="mt-2 text-sm text-muted">
          Check a ticket and check somebody in. Works with a USB barcode scanner.
        </p>
      </div>

      {/* "shasha", not "" - the scope tells the action which guard to run, and the
          company one would bounce a read-only staffer to /company/access on a
          different host entirely. It is not trusted for authorization; it only
          selects the door. */}
      <DoorCheck scope={SHASHA_SCOPE} events={events} />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScopeUser, SHASHA_SCOPE } from "@/lib/portal-scope";
import { ShowsTable } from "@/components/studio/shows-table";

// portal.ronation.live/shasha/shows - RO. Nation LIVE's own line-up.
//
// The same rows /company/events edits, reached from the portal instead of the main
// site. That is the whole point of it existing: a manager working a door at
// /shasha/door had to change hosts to see what was on tonight, and a read-only
// staffer could not see it at all, because /company refuses anyone under rank 245.
//
// Read tier, so rank 200 sees the line-up and the numbers. The Edit links are
// gated on canWrite inside ShowsTable, and every write page guards itself again.

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shows" };

export default async function ShashaShowsPage() {
  const { scope, canWrite } = await requireScopeUser(SHASHA_SCOPE);

  // scope.eventScope, not scope.id: RNL's shows carry partnerId NULL, and the
  // string "shasha" would match none of them. See RosterScope.eventScope.
  const events = await prisma.event.findMany({
    where: { partnerId: scope.eventScope },
    orderBy: { startsAt: "desc" },
    include: { _count: { select: { tickets: true } } },
  });

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
            Line-up
          </p>
          <h1 className="display mt-3 text-5xl">Shows</h1>
          <p className="mt-2 text-sm text-muted">
            RO. Nation LIVE&rsquo;s own shows. Drafts stay hidden; published ones
            appear on ronation.live and open for tickets.
          </p>
        </div>

        {canWrite ? (
          <Link href="/shasha/shows/new" className="btn btn-accent shrink-0">
            + New show
          </Link>
        ) : null}
      </div>

      <ShowsTable
        events={events}
        base="/shasha/shows"
        canWrite={canWrite}
        emptyBlurb={
          canWrite
            ? "Create the first show and it'll appear on ronation.live once you publish it."
            : "Nothing announced yet."
        }
      />
    </div>
  );
}

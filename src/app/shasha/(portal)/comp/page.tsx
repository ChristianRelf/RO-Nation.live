import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { ScopeComp } from "@/components/portal/scope-comp";
import { requireScopeManager, SHASHA_SCOPE } from "@/lib/portal-scope";
import { compOptions } from "@/lib/comp-options";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Comp VIPs" };

export default async function ShashaCompPage({
  searchParams,
}: {
  searchParams: { ok?: string; issued?: string; already?: string; capped?: string; error?: string };
}) {
  const { scope } = await requireScopeManager(SHASHA_SCOPE);

  const [events, vipCount] = await Promise.all([
    prisma.event.findMany({
      // RNL's own: NULL-partnered shows, published and upcoming.
      where: { partnerId: null, status: "PUBLISHED", startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      select: { id: true, title: true, tiers: true },
    }),
    // The roster is keyed by the STRING "shasha", not NULL - see RosterScope.eventScope.
    prisma.rosterEntry.count({ where: { partnerId: scope.id, kind: "VIP" } }),
  ]);

  return (
    <ScopeComp
      scope={scope}
      options={compOptions(events)}
      vipCount={vipCount}
      status={searchParams}
    />
  );
}

import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { ScopeComp } from "@/components/portal/scope-comp";
import { requireScopeManager } from "@/lib/portal-scope";
import { partnerBySlug } from "@/lib/partners/registry";
import { assertPartnerFeature } from "@/lib/partners/guard";
import { compOptions } from "@/lib/comp-options";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Comp VIPs" };

export default async function PartnerCompPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { ok?: string; issued?: string; already?: string; capped?: string; error?: string };
}) {
  const { scope } = await requireScopeManager(params.slug);

  const partner = partnerBySlug(params.slug);
  if (partner) assertPartnerFeature(partner, "events");

  const [events, vipCount] = await Promise.all([
    prisma.event.findMany({
      where: { partnerId: scope.eventScope, status: "PUBLISHED", startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      select: { id: true, title: true, tiers: true },
    }),
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

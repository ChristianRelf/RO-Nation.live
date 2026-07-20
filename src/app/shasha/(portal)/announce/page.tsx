import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { ScopeBroadcast } from "@/components/portal/scope-broadcast";
import { requireScopeManager, SHASHA_SCOPE } from "@/lib/portal-scope";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Announce" };

export default async function ShashaAnnouncePage({
  searchParams,
}: {
  searchParams: { ok?: string; n?: string; error?: string };
}) {
  const { scope } = await requireScopeManager(SHASHA_SCOPE);

  // RNL's own line-up: NULL-partnered, published, still upcoming.
  const shows = await prisma.event.findMany({
    where: { partnerId: null, status: "PUBLISHED", startsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    select: { id: true, title: true, startsAt: true },
  });

  return <ScopeBroadcast scope={scope} shows={shows} status={searchParams} />;
}

import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { ScopeBroadcast } from "@/components/portal/scope-broadcast";
import { requireScopeManager } from "@/lib/portal-scope";
import { partnerBySlug } from "@/lib/partners/registry";
import { assertPartnerFeature } from "@/lib/partners/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Announce" };

export default async function PartnerAnnouncePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { ok?: string; n?: string; error?: string };
}) {
  // Managers only - a broadcast reaches every holder.
  const { scope } = await requireScopeManager(params.slug);

  const partner = partnerBySlug(params.slug);
  if (partner) assertPartnerFeature(partner, "events");

  const shows = await prisma.event.findMany({
    where: { partnerId: scope.eventScope, status: "PUBLISHED", startsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    select: { id: true, title: true, startsAt: true },
  });

  return <ScopeBroadcast scope={scope} shows={shows} status={searchParams} />;
}

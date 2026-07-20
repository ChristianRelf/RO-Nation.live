import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { ScopeFeedback } from "@/components/portal/scope-feedback";
import { requireScopeManager } from "@/lib/portal-scope";
import { partnerBySlug } from "@/lib/partners/registry";
import { assertPartnerFeature } from "@/lib/partners/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Post-show feedback" };

export default async function PartnerFeedbackPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { ok?: string; n?: string; error?: string };
}) {
  const { scope } = await requireScopeManager(params.slug);

  // Needs both the events feature (to have shows) and the surveys feature (to ask).
  const partner = partnerBySlug(params.slug);
  if (partner) {
    assertPartnerFeature(partner, "events");
    assertPartnerFeature(partner, "surveys");
  }

  const [shows, surveys] = await Promise.all([
    prisma.event.findMany({
      where: { partnerId: scope.eventScope, status: "PUBLISHED", startsAt: { lt: new Date() } },
      orderBy: { startsAt: "desc" },
      take: 30,
      select: { id: true, title: true, startsAt: true },
    }),
    prisma.survey.findMany({
      where: { partnerId: scope.eventScope, status: "OPEN" },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
  ]);

  return <ScopeFeedback scope={scope} shows={shows} surveys={surveys} status={searchParams} />;
}

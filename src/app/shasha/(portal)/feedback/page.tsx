import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { ScopeFeedback } from "@/components/portal/scope-feedback";
import { requireScopeManager, SHASHA_SCOPE } from "@/lib/portal-scope";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Post-show feedback" };

export default async function ShashaFeedbackPage({
  searchParams,
}: {
  searchParams: { ok?: string; n?: string; error?: string };
}) {
  const { scope } = await requireScopeManager(SHASHA_SCOPE);

  // RNL's own: NULL-partnered past shows, and NULL-partnered OPEN surveys (authored
  // in /company). scope.eventScope is null for SHASHA, matching both.
  const [shows, surveys] = await Promise.all([
    prisma.event.findMany({
      where: { partnerId: null, status: "PUBLISHED", startsAt: { lt: new Date() } },
      orderBy: { startsAt: "desc" },
      take: 30,
      select: { id: true, title: true, startsAt: true },
    }),
    prisma.survey.findMany({
      where: { partnerId: null, status: "OPEN" },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
  ]);

  return <ScopeFeedback scope={scope} shows={shows} surveys={surveys} status={searchParams} />;
}

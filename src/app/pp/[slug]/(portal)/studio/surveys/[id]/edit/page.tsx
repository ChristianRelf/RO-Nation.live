import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertPartnerFeature, requirePartnerManager } from "@/lib/partners/guard";
import { partnerPortalPath } from "@/lib/partners/urls";
import { AdminHeader } from "@/components/admin-ui";
import { SurveyBuilder } from "@/components/survey-builder";
import { SurveyLink } from "@/components/survey-link";
import { updateSurvey } from "@/app/actions/company";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit survey" };

export default async function StudioEditSurveyPage({
  params,
  searchParams,
}: {
  params: { slug: string; id: string };
  searchParams: { error?: string };
}) {
  const { partner } = await requirePartnerManager(params.slug);
  assertPartnerFeature(partner, "surveys");

  // Scoped read: another org's survey id matches nothing here and 404s.
  const survey = await prisma.survey.findFirst({
    where: { id: params.id, partnerId: partner.slug },
    include: {
      questions: { orderBy: { order: "asc" } },
      _count: { select: { responses: true } },
    },
  });
  if (!survey) notFound();

  const base = partnerPortalPath(partner.slug, "/studio/surveys");

  return (
    <div>
      <AdminHeader
        title="Edit survey"
        subtitle={survey.title}
        action={{ label: "Results", href: `${base}/${survey.id}/responses` }}
      />

      <div className="card mb-6 p-4">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          Share link
        </p>
        <SurveyLink code={survey.code} />
      </div>

      <SurveyBuilder
        action={updateSurvey}
        scope={partner.slug}
        cancelHref={base}
        survey={survey}
        questions={survey.questions}
        error={searchParams.error}
        locked={survey._count.responses > 0}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCompanyUser } from "@/lib/company";
import { AdminHeader } from "@/components/admin-ui";
import { SurveyResults } from "@/components/survey-results";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Survey results" };

export default async function SurveyResponsesPage({
  params,
}: {
  params: { id: string };
}) {
  await requireCompanyUser();

  // Scoped to RNL's own - a partner's survey results are read in its studio, and
  // its id typed here must 404 rather than leak respondent names into /company.
  const survey = await prisma.survey.findFirst({
    where: { id: params.id, partnerId: null },
    include: {
      questions: { orderBy: { order: "asc" }, include: { answers: true } },
      responses: { orderBy: { createdAt: "desc" }, include: { answers: true } },
    },
  });
  if (!survey) notFound();

  const attachments = new Map(
    (
      await prisma.surveyUpload.findMany({
        where: { question: { surveyId: survey.id }, responseId: { not: null } },
        select: { id: true, filename: true, size: true },
      })
    ).map((u) => [u.id, u]),
  );

  return (
    <div>
      <AdminHeader
        title="Results"
        subtitle={survey.title}
        action={{ label: "Edit survey", href: `/company/surveys/${survey.id}/edit` }}
      />
      <SurveyResults
        survey={survey}
        attachments={attachments}
        exportHref={`/api/company/surveys/${survey.id}/export`}
      />
    </div>
  );
}

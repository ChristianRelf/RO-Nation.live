import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCompanyUser } from "@/lib/company";
import { AdminHeader } from "@/components/admin-ui";
import { SurveyBuilder } from "@/components/survey-builder";
import { SurveyLink } from "@/components/survey-link";
import { updateSurvey } from "@/app/actions/company";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit survey" };

export default async function EditSurveyPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  await requireCompanyUser();

  // findFirst with partnerId: null, not findUnique on the id - a partner's survey
  // id pasted into this URL must 404, not open in RNL's dashboard.
  const survey = await prisma.survey.findFirst({
    where: { id: params.id, partnerId: null },
    include: {
      questions: { orderBy: { order: "asc" } },
      _count: { select: { responses: true } },
    },
  });
  if (!survey) notFound();

  return (
    <div>
      <AdminHeader
        title="Edit survey"
        subtitle={survey.title}
        action={{
          label: "Results",
          href: `/company/surveys/${survey.id}/responses`,
        }}
      />

      <div className="card mb-6 p-4">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          Share link
        </p>
        <SurveyLink code={survey.code} />
      </div>

      <SurveyBuilder
        action={updateSurvey}
        survey={survey}
        questions={survey.questions}
        error={searchParams.error}
        locked={survey._count.responses > 0}
      />
    </div>
  );
}

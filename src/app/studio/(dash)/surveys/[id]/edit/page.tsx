import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStudioUser } from "@/lib/studio";
import { AdminHeader } from "@/components/admin-ui";
import { SurveyBuilder } from "@/components/survey-builder";
import { SurveyLink } from "@/components/survey-link";
import { updateSurvey } from "@/app/actions/studio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit survey" };

export default async function EditSurveyPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  await requireStudioUser();

  const survey = await prisma.survey.findUnique({
    where: { id: params.id },
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
          href: `/studio/surveys/${survey.id}/responses`,
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

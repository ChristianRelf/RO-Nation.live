import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertPartnerFeature, requirePartnerUser } from "@/lib/partners/guard";
import { partnerPortalPath } from "@/lib/partners/urls";
import { AdminHeader } from "@/components/admin-ui";
import { SurveyResults } from "@/components/survey-results";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Survey results" };

export default async function StudioSurveyResponsesPage({
  params,
}: {
  params: { slug: string; id: string };
}) {
  const { partner, canWrite } = await requirePartnerUser(params.slug);
  assertPartnerFeature(partner, "surveys");

  // Scoped to this partner - another org's survey id 404s.
  const survey = await prisma.survey.findFirst({
    where: { id: params.id, partnerId: partner.slug },
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

  const base = partnerPortalPath(partner.slug, "/studio/surveys");

  return (
    <div>
      <AdminHeader
        title="Results"
        subtitle={survey.title}
        // Only offer Edit to a manager - a read-only staffer's link would bounce.
        action={
          canWrite ? { label: "Edit survey", href: `${base}/${survey.id}/edit` } : undefined
        }
      />
      {/* No exportHref: the CSV route is /company's. The results below are the full
          picture in the meantime - a scoped partner export can follow later. */}
      <SurveyResults survey={survey} attachments={attachments} exportHref={null} />
    </div>
  );
}

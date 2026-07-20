import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin-ui";
import { SurveyBuilder } from "@/components/survey-builder";
import { createSurvey } from "@/app/actions/company";
import { assertPartnerFeature, requirePartnerManager } from "@/lib/partners/guard";
import { partnerPortalPath } from "@/lib/partners/urls";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New survey" };

export default async function StudioNewSurveyPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { error?: string };
}) {
  const { partner } = await requirePartnerManager(params.slug);
  assertPartnerFeature(partner, "surveys");

  const base = partnerPortalPath(partner.slug, "/studio/surveys");

  return (
    <div>
      <AdminHeader
        title="New survey"
        subtitle="Build the questions, then set it to Open and share the link. Respondents sign in with Roblox and answer once."
      />
      {/* scope pins the shared action to this partner; cancelHref keeps Cancel inside
          the studio rather than sending them to /company. */}
      <SurveyBuilder
        action={createSurvey}
        scope={partner.slug}
        cancelHref={base}
        error={searchParams.error}
      />
    </div>
  );
}

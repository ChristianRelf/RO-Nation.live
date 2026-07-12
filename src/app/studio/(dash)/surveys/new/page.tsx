import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin-ui";
import { SurveyBuilder } from "@/components/survey-builder";
import { createSurvey } from "@/app/actions/studio";
import { requireStudioUser } from "@/lib/studio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New survey" };

export default async function NewSurveyPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  await requireStudioUser();

  return (
    <div>
      <AdminHeader
        title="New survey"
        subtitle="Build the questions, then set it to Open and share the link. Respondents sign in with Roblox and answer once."
      />
      <SurveyBuilder action={createSurvey} error={searchParams.error} />
    </div>
  );
}

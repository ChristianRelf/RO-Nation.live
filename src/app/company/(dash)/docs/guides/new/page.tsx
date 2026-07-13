import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin-ui";
import { GuideForm } from "@/components/guide-form";
import { createGuide } from "@/app/actions/docs";
import { guideSections } from "@/lib/docs";
import { requireCompanyUser } from "@/lib/company";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New guide" };

export default async function CompanyNewGuidePage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  await requireCompanyUser();
  const sections = await guideSections();

  return (
    <div>
      <AdminHeader
        title="New guide"
        subtitle="Save it as a draft while you work, then switch it to Published when it's ready."
      />
      <GuideForm
        action={createGuide}
        sections={sections}
        error={searchParams.error}
      />
    </div>
  );
}

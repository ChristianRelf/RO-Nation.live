import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AdminHeader } from "@/components/admin-ui";
import { GuideForm } from "@/components/guide-form";
import { updateGuide } from "@/app/actions/docs";
import { guideSections } from "@/lib/docs";
import { requireCompanyUser } from "@/lib/company";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit guide" };

export default async function CompanyEditGuidePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  await requireCompanyUser();

  const guide = await prisma.guide.findUnique({ where: { id: params.id } });
  if (!guide) notFound();

  const sections = await guideSections();

  return (
    <div>
      <AdminHeader
        title="Edit guide"
        subtitle={`Last saved ${guide.updatedAt.toLocaleString("en-GB")}.`}
      />
      <GuideForm
        action={updateGuide}
        guide={guide}
        sections={sections}
        error={searchParams.error}
      />
    </div>
  );
}

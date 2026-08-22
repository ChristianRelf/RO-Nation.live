import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AdminHeader } from "@/components/admin-ui";
import { PartnerGroupForm } from "@/components/partner-group-form";
import { requireCompanyUser } from "@/lib/company";

export const dynamic = "force-dynamic";

export default async function EditPartnerGroupPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  await requireCompanyUser();

  const group = await prisma.partnerGroup.findUnique({ where: { id: params.id } });
  if (!group) notFound();

  return (
    <div>
      <AdminHeader
        title={group.name}
        subtitle="The Roblox group is fixed. Everything else is yours."
      />

      {searchParams.error === "required" ? (
        <p className="mb-6 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          A description is required.
        </p>
      ) : null}

      <PartnerGroupForm group={group} />
    </div>
  );
}

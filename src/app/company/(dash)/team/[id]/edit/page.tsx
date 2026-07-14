import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AdminHeader } from "@/components/admin-ui";
import { TeamMemberForm } from "@/components/team-member-form";
import { requireCompanyUser } from "@/lib/company";

export const dynamic = "force-dynamic";

export default async function EditTeamMemberPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  await requireCompanyUser();

  const member = await prisma.teamMember.findUnique({
    where: { id: params.id },
  });
  if (!member) notFound();

  return (
    <div>
      <AdminHeader
        title={member.displayName}
        subtitle="The Roblox account is fixed. Everything else is yours."
      />

      {searchParams.error === "required" ? (
        <p className="mb-6 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          A role is required.
        </p>
      ) : null}

      <TeamMemberForm member={member} />
    </div>
  );
}

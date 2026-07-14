import { AdminHeader } from "@/components/admin-ui";
import { TeamMemberForm } from "@/components/team-member-form";
import { requireCompanyUser } from "@/lib/company";

export const dynamic = "force-dynamic";

export default async function NewTeamMemberPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  // Guarded here as well as in the layout. A layout-only redirect still ships this page's
  // RSC payload inside the 307 that bounced it - the rule is written out in lib/session.ts
  // and it holds for every page in this dashboard.
  await requireCompanyUser();

  return (
    <div>
      <AdminHeader
        title="Add someone to the crew"
        subtitle="Search Roblox for them. You can't type a person in - only find one."
      />

      {searchParams.error === "required" ? (
        <p className="mb-6 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Pick a Roblox account and give them a role.
        </p>
      ) : null}
      {searchParams.error === "roblox" ? (
        <p className="mb-6 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Roblox didn&apos;t recognise that account, so nothing was saved.
        </p>
      ) : null}

      <TeamMemberForm />
    </div>
  );
}

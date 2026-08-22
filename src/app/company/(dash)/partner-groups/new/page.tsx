import { AdminHeader } from "@/components/admin-ui";
import { PartnerGroupForm } from "@/components/partner-group-form";
import { requireCompanyUser } from "@/lib/company";

export const dynamic = "force-dynamic";

export default async function NewPartnerGroupPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  await requireCompanyUser();

  return (
    <div>
      <AdminHeader
        title="Add a partner group"
        subtitle="Give its Roblox group id. You can't type a name in - only find one."
      />

      {searchParams.error === "required" ? (
        <p className="mb-6 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Give the group&apos;s Roblox id and a description.
        </p>
      ) : null}
      {searchParams.error === "roblox" ? (
        <p className="mb-6 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Roblox didn&apos;t recognise that group id, so nothing was saved.
        </p>
      ) : null}

      <PartnerGroupForm />
    </div>
  );
}

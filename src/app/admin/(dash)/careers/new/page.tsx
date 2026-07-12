import { AdminHeader } from "@/components/admin-ui";
import { CareerForm } from "@/components/career-form";
import { createCareer } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default function NewCareerPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div>
      <AdminHeader
        title="New role"
        subtitle="Set the status to Open when you're ready to take applications."
      />
      <CareerForm action={createCareer} error={searchParams.error} />
    </div>
  );
}

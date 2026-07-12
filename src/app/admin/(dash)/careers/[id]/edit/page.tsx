import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AdminHeader } from "@/components/admin-ui";
import { CareerForm } from "@/components/career-form";
import { updateCareer } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function EditCareerPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  await requireAdmin();
  const career = await prisma.career.findUnique({ where: { id: params.id } });
  if (!career) notFound();

  return (
    <div>
      <AdminHeader title="Edit role" subtitle={career.title} />
      <CareerForm action={updateCareer} career={career} error={searchParams.error} />
    </div>
  );
}

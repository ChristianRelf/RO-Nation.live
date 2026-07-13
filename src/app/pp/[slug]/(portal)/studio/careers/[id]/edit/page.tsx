import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  assertPartnerFeature,
  requirePartnerManager,
} from "@/lib/partners/guard";
import { partnerPortalPath } from "@/lib/partners/urls";
import {
  deletePartnerCareer,
  updatePartnerCareer,
} from "@/app/actions/partner-content";
import { CareerForm } from "@/components/career-form";
import { ConfirmButton } from "@/components/confirm-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit role" };

export default async function EditPartnerCareerPage({
  params,
  searchParams,
}: {
  params: { slug: string; id: string };
  searchParams: { error?: string };
}) {
  const { partner } = await requirePartnerManager(params.slug);
  assertPartnerFeature(partner, "careers");

  // Matched on the partner as well as the id — another org's role 404s here.
  const career = await prisma.career.findFirst({
    where: { id: params.id, partnerId: partner.slug },
  });
  if (!career) notFound();

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <h1 className="display text-4xl">Edit role</h1>
          <p className="mt-2 text-sm text-muted">{career.title}</p>
        </div>

        <form action={deletePartnerCareer}>
          <input type="hidden" name="id" value={career.id} />
          <input type="hidden" name="scope" value={partner.slug} />
          <ConfirmButton
            message={`Delete "${career.title}"? Its applications go with it.`}
            className="text-sm text-faint transition-colors hover:text-red-400"
          >
            Delete role
          </ConfirmButton>
        </form>
      </div>

      <CareerForm
        action={updatePartnerCareer}
        career={career}
        error={searchParams.error}
        scope={partner.slug}
        cancelHref={partnerPortalPath(partner.slug, "/studio/careers")}
      />
    </div>
  );
}

import type { Metadata } from "next";
import {
  assertPartnerFeature,
  requirePartnerManager,
} from "@/lib/partners/guard";
import { partnerPortalPath } from "@/lib/partners/urls";
import { createPartnerCareer } from "@/app/actions/partner-content";
import { CareerForm } from "@/components/career-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New role" };

export default async function NewPartnerCareerPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { error?: string };
}) {
  const { partner } = await requirePartnerManager(params.slug);
  assertPartnerFeature(partner, "careers");

  return (
    <div>
      <div className="mb-8 border-b border-line pb-6">
        <h1 className="display text-4xl">New role</h1>
        <p className="mt-2 text-sm text-muted">
          Drafts stay hidden. Open roles accept applications.
        </p>
      </div>

      <CareerForm
        action={createPartnerCareer}
        error={searchParams.error}
        scope={partner.slug}
        cancelHref={partnerPortalPath(partner.slug, "/studio/careers")}
      />
    </div>
  );
}

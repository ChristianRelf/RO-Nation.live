import type { Metadata } from "next";
import { requirePartnerManager } from "@/lib/partners/guard";
import { getPartnerContent } from "@/lib/partners/content";
import { partnerOrigin, partnerPortalPath } from "@/lib/partners/urls";
import { updatePartnerContent } from "@/app/actions/partner-content";
import { PartnerContentForm } from "@/components/partner/content-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Homepage" };

// The homepage copy. Not behind a feature flag: every partner has a homepage,
// whatever else the registry gave them.
//
// Write tier only — this is the one studio section with nothing worth reading if
// you cannot change it, since the page itself is public anyway.

export default async function PartnerContentPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { ok?: string; error?: string };
}) {
  const { partner } = await requirePartnerManager(params.slug);
  const content = await getPartnerContent(partner);

  return (
    <div>
      <div className="mb-8 border-b border-line pb-6">
        <h1 className="display text-4xl">Homepage</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          The words on{" "}
          <a
            href={partnerOrigin(partner.slug)}
            className="text-fg underline underline-offset-4 hover:text-accent"
          >
            {partnerOrigin(partner.slug).replace(/^https?:\/\//, "")}
          </a>
          . Anything you leave empty falls back to the default, so you can change
          one line without rewriting the page.
        </p>
      </div>

      <PartnerContentForm
        action={updatePartnerContent}
        content={content}
        slug={partner.slug}
        error={searchParams.error}
        saved={searchParams.ok === "1"}
        cancelHref={partnerPortalPath(partner.slug, "/studio")}
      />
    </div>
  );
}

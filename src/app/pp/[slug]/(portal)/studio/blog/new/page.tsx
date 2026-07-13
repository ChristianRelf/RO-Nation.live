import type { Metadata } from "next";
import {
  assertPartnerFeature,
  requirePartnerManager,
} from "@/lib/partners/guard";
import { partnerPortalPath } from "@/lib/partners/urls";
import { createPartnerPost } from "@/app/actions/partner-content";
import { PostForm } from "@/components/post-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New post" };

export default async function NewPartnerPostPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { error?: string };
}) {
  // The write tier. Read-only staff are bounced before this page renders — and
  // the action re-checks anyway, because a page guard does not protect a POST.
  const { partner } = await requirePartnerManager(params.slug);
  assertPartnerFeature(partner, "blog");

  return (
    <div>
      <div className="mb-8 border-b border-line pb-6">
        <h1 className="display text-4xl">New post</h1>
        <p className="mt-2 text-sm text-muted">
          Saved as a draft unless you set it live.
        </p>
      </div>

      <PostForm
        action={createPartnerPost}
        error={searchParams.error}
        scope={partner.slug}
        cancelHref={partnerPortalPath(partner.slug, "/studio/blog")}
      />
    </div>
  );
}

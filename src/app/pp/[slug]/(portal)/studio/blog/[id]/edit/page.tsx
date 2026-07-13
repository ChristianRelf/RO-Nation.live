import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  assertPartnerFeature,
  requirePartnerManager,
} from "@/lib/partners/guard";
import { partnerPortalPath } from "@/lib/partners/urls";
import {
  deletePartnerPost,
  updatePartnerPost,
} from "@/app/actions/partner-content";
import { PostForm } from "@/components/post-form";
import { ConfirmButton } from "@/components/confirm-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit post" };

export default async function EditPartnerPostPage({
  params,
  searchParams,
}: {
  params: { slug: string; id: string };
  searchParams: { error?: string };
}) {
  const { partner } = await requirePartnerManager(params.slug);
  assertPartnerFeature(partner, "blog");

  // Matched on the partner as well as the id: another org's post id must 404
  // here, not open in this partner's editor.
  const post = await prisma.post.findFirst({
    where: { id: params.id, partnerId: partner.slug },
  });
  if (!post) notFound();

  const base = partnerPortalPath(partner.slug, "/studio/blog");

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <h1 className="display text-4xl">Edit post</h1>
          <p className="mt-2 text-sm text-muted">{post.title}</p>
        </div>

        <form action={deletePartnerPost}>
          <input type="hidden" name="id" value={post.id} />
          <input type="hidden" name="scope" value={partner.slug} />
          <ConfirmButton
            message={`Delete "${post.title}"? This cannot be undone.`}
            className="text-sm text-faint transition-colors hover:text-red-400"
          >
            Delete post
          </ConfirmButton>
        </form>
      </div>

      <PostForm
        action={updatePartnerPost}
        post={post}
        error={searchParams.error}
        scope={partner.slug}
        cancelHref={base}
      />
    </div>
  );
}

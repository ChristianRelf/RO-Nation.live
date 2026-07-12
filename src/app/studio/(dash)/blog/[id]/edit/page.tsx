import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AdminHeader } from "@/components/admin-ui";
import { PostForm } from "@/components/post-form";
import { updatePost } from "@/app/actions/studio";
import { requireStudioUser } from "@/lib/studio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit post" };

export default async function StudioEditPostPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  await requireStudioUser();
  const post = await prisma.post.findUnique({ where: { id: params.id } });
  if (!post) notFound();

  return (
    <div>
      <AdminHeader
        title="Edit post"
        subtitle={`${post.title} · by ${post.authorName}`}
        action={
          post.status === "PUBLISHED"
            ? { label: "View post", href: `/blog/${post.slug}` }
            : undefined
        }
      />
      <PostForm action={updatePost} post={post} error={searchParams.error} />
    </div>
  );
}

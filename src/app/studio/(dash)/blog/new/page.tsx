import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin-ui";
import { PostForm } from "@/components/post-form";
import { createPost } from "@/app/actions/studio";
import { requireStudioUser } from "@/lib/studio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New post" };

export default async function StudioNewPostPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  await requireStudioUser();
  return (
    <div>
      <AdminHeader
        title="New post"
        subtitle="Save it as a draft while you work, then switch it to Published when it's ready."
      />
      <PostForm action={createPost} error={searchParams.error} />
    </div>
  );
}

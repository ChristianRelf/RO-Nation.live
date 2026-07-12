import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { AdminHeader, Badge } from "@/components/admin-ui";
import { ConfirmButton } from "@/components/confirm-button";
import { deletePost } from "@/app/actions/studio";
import { formatDateTime } from "@/lib/format";
import { requireStudioUser } from "@/lib/studio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Blog" };

export default async function StudioBlogPage() {
  await requireStudioUser();
  const posts = await prisma.post.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <AdminHeader
        title="Blog"
        subtitle="Drafts stay hidden. Published posts appear at /blog straight away."
        action={{ label: "+ New post", href: "/studio/blog/new" }}
      />

      {posts.length ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-semibold">Post</th>
                  <th className="px-5 py-3 font-semibold">Author</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {posts.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-4">
                      <span className="font-medium">{p.title}</span>
                      <span className="block text-xs text-muted">
                        {p.publishedAt
                          ? formatDateTime(p.publishedAt)
                          : `Created ${formatDateTime(p.createdAt)}`}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-muted">{p.authorName}</td>
                    <td className="px-5 py-4">
                      <Badge value={p.status} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-3">
                        {p.status === "PUBLISHED" ? (
                          <Link
                            href={`/blog/${p.slug}`}
                            className="text-muted hover:text-fg"
                          >
                            View
                          </Link>
                        ) : null}
                        <Link
                          href={`/studio/blog/${p.id}/edit`}
                          className="text-muted hover:text-fg"
                        >
                          Edit
                        </Link>
                        <form action={deletePost}>
                          <input type="hidden" name="id" value={p.id} />
                          <ConfirmButton
                            className="text-faint hover:text-red-400"
                            message={`Delete "${p.title}"? This can't be undone.`}
                          >
                            Delete
                          </ConfirmButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card grid place-items-center px-6 py-20 text-center">
          <p className="font-display text-2xl">No posts yet</p>
          <p className="mt-2 text-sm text-muted">
            Write a recap, an announcement, or a behind-the-scenes piece.
          </p>
          <Link href="/studio/blog/new" className="btn btn-accent mt-5">
            Write the first one
          </Link>
        </div>
      )}
    </div>
  );
}

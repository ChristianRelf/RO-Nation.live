import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertPartnerFeature, requirePartnerUser } from "@/lib/partners/guard";
import { partnerPortalPath } from "@/lib/partners/urls";
import { LocalTime } from "@/components/local-time";
import { StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Blog" };

export default async function PartnerBlogPage({
  params,
}: {
  params: { slug: string };
}) {
  const { partner, canWrite } = await requirePartnerUser(params.slug);
  assertPartnerFeature(partner, "blog");

  // This partner's posts, and only theirs.
  const posts = await prisma.post.findMany({
    where: { partnerId: partner.slug },
    orderBy: { createdAt: "desc" },
  });

  const base = partnerPortalPath(partner.slug, "/studio/blog");

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="display text-4xl">Blog</h1>
          <p className="mt-2 text-sm text-muted">
            Recaps, announcements, and anything you want on your own site.
          </p>
        </div>
        {canWrite ? (
          <Link href={`${base}/new`} className="btn btn-accent shrink-0">
            + New post
          </Link>
        ) : null}
      </div>

      {posts.length ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-semibold">Post</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Published</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-fg">{p.title}</p>
                      <p className="text-xs text-faint">by {p.authorName}</p>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge
                        status={p.status === "PUBLISHED" ? "upcoming" : "closed"}
                      >
                        {p.status === "PUBLISHED"
                          ? "Live"
                          : p.status === "DRAFT"
                            ? "Draft"
                            : "Archived"}
                      </StatusBadge>
                    </td>
                    <td className="tnum px-5 py-4 text-muted">
                      {p.publishedAt ? <LocalTime value={p.publishedAt} mode="date" /> : "-"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {canWrite ? (
                        <Link
                          href={`${base}/${p.id}/edit`}
                          className="text-sm text-accent hover:text-fg"
                        >
                          Edit
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <p className="font-display text-2xl uppercase">Nothing written yet</p>
          <p className="mt-2 max-w-sm text-sm text-muted">
            {canWrite
              ? "Your first post will appear on your site the moment you publish it."
              : "Management hasn't published anything yet."}
          </p>
          {canWrite ? (
            <Link href={`${base}/new`} className="btn btn-accent mt-6">
              + New post
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}

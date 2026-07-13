import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { partnerBySlug } from "@/lib/partners/registry";
import { assertPartnerFeature } from "@/lib/partners/guard";
import { getPublishedPosts } from "@/lib/queries";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const partner = partnerBySlug(params.slug);
  return {
    title: "Blog",
    description: partner ? `News and recaps from ${partner.name}.` : undefined,
  };
}

export default async function PartnerBlogIndex({
  params,
}: {
  params: { slug: string };
}) {
  const partner = partnerBySlug(params.slug);
  if (!partner) notFound();
  // A partner without the blog feature has no blog. 404, rather than an empty
  // page that implies they simply haven't written anything.
  assertPartnerFeature(partner, "blog");

  // Scoped to this partner: RNL's posts are not theirs to show.
  const posts = await getPublishedPosts(partner.slug);

  return (
    <div className="shell py-20">
      <div className="mb-12 border-b border-line pb-10">
        <p className="kicker text-accent">Words</p>
        <h1 className="display mt-4 text-5xl sm:text-6xl">Blog</h1>
        <p className="mt-5 max-w-xl leading-relaxed text-muted">
          Recaps, announcements, and the odd look behind the curtain.
        </p>
      </div>

      {posts.length ? (
        <ul className="divide-y divide-line border-y border-line">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                href={`/blog/${post.slug}`}
                className="group flex flex-col gap-2 py-8 transition-colors hover:bg-surface sm:flex-row sm:items-baseline sm:gap-8 sm:px-2"
              >
                <span className="tnum w-32 shrink-0 text-sm text-faint">
                  {post.publishedAt ? formatDate(post.publishedAt) : ""}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="display text-2xl transition-colors group-hover:text-accent">
                    {post.title}
                  </h2>
                  {post.excerpt ? (
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
                      {post.excerpt}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 text-sm text-faint transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card grid place-items-center px-6 py-20 text-center">
          <p className="display text-3xl">Nothing written yet</p>
          <p className="mt-3 max-w-sm text-muted">
            Check back — the first post will land here.
          </p>
        </div>
      )}
    </div>
  );
}

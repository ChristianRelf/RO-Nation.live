import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostBySlug } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";

// null = RNL's own. Scoped, so a partner's post is not reachable at
// ronation.live/blog/<slug> even when the slug is known — drafts and archived
// posts are not public either, whatever URL you have.
async function getPost(slug: string) {
  return getPostBySlug(null, slug);
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPost(params.slug);
  if (!post) return { title: "Post not found" };

  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      type: "article",
      publishedTime: post.publishedAt?.toISOString(),
      images: post.coverUrl ? [post.coverUrl] : undefined,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = await getPost(params.slug);
  if (!post) notFound();

  // Blank lines separate paragraphs; single newlines are kept inside them.
  const paragraphs = post.body.split(/\n\s*\n/).filter((p) => p.trim());

  return (
    <article className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-56" />

      <div className="shell relative max-w-3xl pt-16 sm:pt-20">
        <Kicker>From the crew</Kicker>

        <h1 className="display mt-5 text-4xl sm:text-5xl md:text-6xl">
          {post.title}
        </h1>

        <p className="mt-5 text-sm text-faint">
          {post.publishedAt ? (
            <time dateTime={post.publishedAt.toISOString()}>
              {formatDate(post.publishedAt)}
            </time>
          ) : null}
          {post.publishedAt ? " · " : ""}
          By {post.authorName}
        </p>

        {post.excerpt ? (
          <p className="mt-6 text-lg leading-relaxed text-muted">
            {post.excerpt}
          </p>
        ) : null}
      </div>

      {post.coverUrl ? (
        <div className="shell relative mt-10 max-w-3xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.coverUrl}
            alt=""
            className="aspect-[3/2] w-full rounded-[3px] border border-line object-cover"
          />
        </div>
      ) : null}

      <div className="shell max-w-3xl py-12">
        <div className="space-y-5 text-lg leading-relaxed text-muted">
          {paragraphs.map((p, i) => (
            <p key={i} className="whitespace-pre-line">
              {p}
            </p>
          ))}
        </div>

        <div className="mt-14 border-t border-line pt-6">
          <Link
            href="/blog"
            className="text-sm font-semibold text-accent hover:text-fg"
          >
            ← All posts
          </Link>
        </div>
      </div>
    </article>
  );
}

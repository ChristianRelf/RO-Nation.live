import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { partnerBySlug } from "@/lib/partners/registry";
import { assertPartnerFeature } from "@/lib/partners/guard";
import { getPostBySlug } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { toLines } from "@/lib/utils";

export const dynamic = "force-dynamic";

// The segment is [post], not [slug]: [slug] is already taken by the partner one
// higher up, and Next forbids two different names at the same position in a path.
// Same reason /p/[slug]/events/[event] is named the way it is.

type Params = { params: { slug: string; post: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const partner = partnerBySlug(params.slug);
  if (!partner) return {};

  const post = await getPostBySlug(partner.slug, params.post);
  if (!post) return { title: "Post not found" };

  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      images: post.coverUrl ? [post.coverUrl] : undefined,
      type: "article",
    },
  };
}

export default async function PartnerPostPage({ params }: Params) {
  const partner = partnerBySlug(params.slug);
  if (!partner) notFound();
  assertPartnerFeature(partner, "blog");

  // Scoped: RNL's post, or another partner's, is not reachable from this host
  // even with the slug in hand. Drafts and archived posts are not public either.
  const post = await getPostBySlug(partner.slug, params.post);
  if (!post) notFound();

  return (
    <article className="shell py-20">
      <Link
        href="/blog"
        className="text-sm text-faint transition-colors hover:text-fg"
      >
        ← All posts
      </Link>

      <header className="mt-8 border-b border-line pb-10">
        <p className="tnum text-sm text-faint">
          {post.publishedAt ? formatDate(post.publishedAt) : ""}
        </p>
        <h1 className="display mt-4 text-4xl leading-tight sm:text-6xl">
          {post.title}
        </h1>
        <p className="mt-5 text-sm text-muted">by {post.authorName}</p>
      </header>

      {post.coverUrl ? (
        // Not next/image: the URL is whatever the author typed or uploaded, and a
        // remote host that isn't in next.config's remotePatterns throws rather
        // than degrading. A cover image is not worth a 500.
        //
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.coverUrl}
          alt=""
          className="mt-10 w-full rounded-brand border border-line object-cover"
        />
      ) : null}

      <div className="mt-10 max-w-2xl space-y-5 leading-relaxed text-muted">
        {toLines(post.body).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
    </article>
  );
}

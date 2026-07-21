import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedPosts } from "@/lib/queries";
import { Reveal } from "@/components/reveal";
import { Kicker } from "@/components/ui";
import { LocalTime } from "@/components/local-time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Blog",
  description:
    "Recaps, announcements and behind-the-scenes stories from the RO. Nation LIVE crew.",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage() {
  // null = RNL's own. A partner's posts live on the partner's own blog.
  const posts = await getPublishedPosts(null);

  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-64" />

      <div className="shell relative pt-16 sm:pt-20">
        <Kicker>From the crew</Kicker>
        <h1 className="display mt-5 text-5xl sm:text-6xl md:text-7xl">Blog</h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Show recaps, announcements, and the odd look behind the curtain at how
          we build a stage.
        </p>
      </div>

      <section className="shell py-14">
        {posts.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, i) => (
              <Reveal key={post.id} delay={(i % 3) * 60}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="card card-hover group flex h-full flex-col overflow-hidden"
                >
                  {post.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.coverUrl}
                      alt=""
                      className="aspect-[3/2] w-full object-cover"
                    />
                  ) : null}

                  <div className="flex flex-1 flex-col p-6">
                    {post.publishedAt ? (
                      <time className="text-xs font-semibold uppercase tracking-kicker text-faint">
                        <LocalTime value={post.publishedAt} mode="date" />
                      </time>
                    ) : null}

                    <h2 className="mt-2 font-display text-2xl uppercase leading-tight">
                      {post.title}
                    </h2>

                    {post.excerpt ? (
                      <p className="mt-3 line-clamp-3 text-sm text-muted">
                        {post.excerpt}
                      </p>
                    ) : null}

                    <span className="mt-auto pt-5 text-sm font-semibold text-accent">
                      Read
                      <span className="ml-1 inline-block transition-transform group-hover:translate-x-1">
                        →
                      </span>
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="card grid place-items-center px-6 py-24 text-center">
            <p className="font-display text-3xl uppercase">Nothing here yet</p>
            <p className="mt-3 max-w-sm text-muted">
              The crew hasn&apos;t published anything yet. Check back after the
              next show.
            </p>
            <Link href="/events" className="btn btn-accent mt-7">
              See upcoming events
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

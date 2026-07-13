import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireDocsReader } from "@/lib/docs-guard";
import { Prose } from "@/components/prose";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  // No guard here, and none needed: a title is all this reads, and the page below
  // refuses to render a word of the body without one. Metadata for a guide that
  // does not exist — or is still a draft — comes out as the fallback.
  const guide = await prisma.guide.findFirst({
    where: { slug: params.slug, status: "PUBLISHED" },
    select: { title: true },
  });
  return { title: guide?.title ?? "Guide" };
}

export default async function DocsGuidePage({
  params,
}: {
  params: { slug: string };
}) {
  await requireDocsReader();

  // PUBLISHED, not just "by slug". A draft is not a page with a harder URL — it
  // is not a page at all, and guessing its slug must not turn it into one.
  const guide = await prisma.guide.findFirst({
    where: { slug: params.slug, status: "PUBLISHED" },
  });
  if (!guide) notFound();

  return (
    <article className="max-w-3xl">
      <Link
        href="/docs/guides"
        className="text-sm text-muted transition-colors hover:text-fg"
      >
        ← Guides
      </Link>

      <header className="mt-6 border-b border-line pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
          {guide.section}
        </p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">{guide.title}</h1>
        {guide.excerpt ? (
          <p className="mt-4 text-muted">{guide.excerpt}</p>
        ) : null}
        <p className="mt-4 text-xs text-faint">
          {guide.authorName} · updated {formatDateTime(guide.updatedAt)}
        </p>
      </header>

      <Prose content={guide.body} className="mt-8" />
    </article>
  );
}

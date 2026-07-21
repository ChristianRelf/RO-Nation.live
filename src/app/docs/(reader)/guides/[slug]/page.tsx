import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireDocsReader } from "@/lib/docs-guard";
import { Prose } from "@/components/prose";
import { LocalTime } from "@/components/local-time";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  // No guard here, and none needed: a title is all this reads, and the page below
  // refuses to render a word of the body without one. Metadata for a guide that
  // does not exist - or is still a draft - comes out as the fallback.
  const guide = await prisma.guide.findFirst({
    where: { slug: params.slug, status: "PUBLISHED" },
    select: { title: true },
  });
  return { title: guide?.title ?? "Guide" };
}

// One reader for every kind - slugs are unique across the whole library, so the
// area a guide belongs to comes from its own `kind`, and that is what the "back"
// link and the kicker point at. Add an area, add a row here.
const AREA: Record<string, { href: string; label: string }> = {
  GUIDE: { href: "/docs/guides", label: "Guides" },
  RUNBOOK: { href: "/docs/runbooks", label: "Runbooks" },
  ONBOARDING: { href: "/docs/onboarding", label: "Onboarding" },
};

export default async function DocsGuidePage({
  params,
}: {
  params: { slug: string };
}) {
  await requireDocsReader();

  // PUBLISHED, not just "by slug". A draft is not a page with a harder URL - it
  // is not a page at all, and guessing its slug must not turn it into one.
  const guide = await prisma.guide.findFirst({
    where: { slug: params.slug, status: "PUBLISHED" },
  });
  if (!guide) notFound();

  const area = AREA[guide.kind] ?? AREA.GUIDE;

  return (
    <article className="max-w-3xl">
      <Link
        href={area.href}
        className="text-sm text-muted transition-colors hover:text-fg"
      >
        ← {area.label}
      </Link>

      <header className="mt-6 border-b border-line pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
          {area.label} · {guide.section}
        </p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">{guide.title}</h1>
        {guide.excerpt ? (
          <p className="mt-4 text-muted">{guide.excerpt}</p>
        ) : null}
        <p className="mt-4 text-xs text-faint">
          {guide.authorName} · updated <LocalTime value={guide.updatedAt} mode="datetime" />
        </p>
      </header>

      <Prose content={guide.body} className="mt-8" />
    </article>
  );
}

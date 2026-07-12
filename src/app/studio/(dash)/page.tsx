import Link from "next/link";
import { prisma } from "@/lib/db";
import { getStudioUser } from "@/lib/studio";
import { AdminHeader, StatCard } from "@/components/admin-ui";
import { requireStudioUser } from "@/lib/studio";

export const dynamic = "force-dynamic";

export default async function StudioOverviewPage() {
  await requireStudioUser();
  const user = await getStudioUser();

  const [events, published, posts, drafts] = await Promise.all([
    prisma.event.count(),
    prisma.event.count({ where: { status: "PUBLISHED" } }),
    prisma.post.count(),
    prisma.post.count({ where: { status: "DRAFT" } }),
  ]);

  return (
    <div>
      <AdminHeader
        title={`Hey ${user?.displayName ?? "there"}`}
        subtitle="Create events and write for the blog. Anything you publish goes live on the site straight away."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Events" value={events} hint={`${published} published`} />
        <StatCard label="Blog posts" value={posts} hint={`${drafts} in draft`} />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link href="/studio/events/new" className="card card-hover p-6">
          <p className="font-display text-2xl uppercase">+ New event</p>
          <p className="mt-2 text-sm text-muted">
            Set the date, venue and capacity, then publish to open ticketing.
          </p>
        </Link>

        <Link href="/studio/blog/new" className="card card-hover p-6">
          <p className="font-display text-2xl uppercase">+ New post</p>
          <p className="mt-2 text-sm text-muted">
            Write a recap, an announcement, or a behind-the-scenes piece.
          </p>
        </Link>
      </div>
    </div>
  );
}

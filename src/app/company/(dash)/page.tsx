import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCompanyUser } from "@/lib/company";
import { AdminHeader, StatCard } from "@/components/admin-ui";
import { requireCompanyUser } from "@/lib/company";

export const dynamic = "force-dynamic";

export default async function CompanyOverviewPage() {
  await requireCompanyUser();
  const user = await getCompanyUser();

  const [events, published, posts, drafts, surveys, responses] =
    await Promise.all([
      // RNL's own - a partner's events are counted in their portal, not here.
      prisma.event.count({ where: { partnerId: null } }),
      prisma.event.count({ where: { partnerId: null, status: "PUBLISHED" } }),
      prisma.post.count(),
      prisma.post.count({ where: { status: "DRAFT" } }),
      prisma.survey.count({ where: { status: "OPEN" } }),
      prisma.surveyResponse.count(),
    ]);

  return (
    <div>
      <AdminHeader
        title={`Hey ${user?.displayName ?? "there"}`}
        subtitle="Create events and write for the blog. Anything you publish goes live on the site straight away."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Events" value={events} hint={`${published} published`} />
        <StatCard label="Blog posts" value={posts} hint={`${drafts} in draft`} />
        <StatCard
          label="Open surveys"
          value={surveys}
          hint={`${responses} response${responses === 1 ? "" : "s"} in total`}
        />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Link href="/company/events/new" className="card card-hover p-6">
          <p className="font-display text-2xl uppercase">+ New event</p>
          <p className="mt-2 text-sm text-muted">
            Set the date, venue and capacity, then publish to open ticketing.
          </p>
        </Link>

        <Link href="/company/blog/new" className="card card-hover p-6">
          <p className="font-display text-2xl uppercase">+ New post</p>
          <p className="mt-2 text-sm text-muted">
            Write a recap, an announcement, or a behind-the-scenes piece.
          </p>
        </Link>

        <Link href="/company/surveys/new" className="card card-hover p-6">
          <p className="font-display text-2xl uppercase">+ New survey</p>
          <p className="mt-2 text-sm text-muted">
            Ask the crowd how a show went. One answer per Roblox account.
          </p>
        </Link>
      </div>
    </div>
  );
}

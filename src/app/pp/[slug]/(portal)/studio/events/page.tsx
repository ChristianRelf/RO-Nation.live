import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertPartnerFeature, requirePartnerUser } from "@/lib/partners/guard";
import { partnerPortalPath } from "@/lib/partners/urls";
import { ShowsTable } from "@/components/studio/shows-table";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shows" };

export default async function PartnerShowsPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await requirePartnerUser(params.slug);
  const { partner, canWrite } = user;
  assertPartnerFeature(partner, "events");

  // This partner's shows, and only theirs.
  const events = await prisma.event.findMany({
    where: { partnerId: partner.slug },
    orderBy: { startsAt: "desc" },
    include: { _count: { select: { tickets: true } } },
  });

  const base = partnerPortalPath(partner.slug, "/studio/events");

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
            Line-up
          </p>
          <h1 className="display mt-3 text-5xl">Shows</h1>
          <p className="mt-2 text-sm text-muted">
            Drafts stay hidden. Published shows appear on your site and open for
            tickets.
          </p>
        </div>

        {canWrite ? (
          <Link href={`${base}/new`} className="btn btn-accent shrink-0">
            + New show
          </Link>
        ) : null}
      </div>

      <ShowsTable
        events={events}
        base={base}
        canWrite={canWrite}
        emptyBlurb={
          canWrite
            ? "Create your first show and it'll appear on your site once you publish it."
            : "Management hasn't announced any shows yet."
        }
      />
    </div>
  );
}

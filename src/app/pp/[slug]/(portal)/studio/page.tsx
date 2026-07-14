import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePartnerUser } from "@/lib/partners/guard";
import { partnerHasFeature } from "@/lib/partners/registry";
import { partnerOrigin, partnerPortalPath } from "@/lib/partners/urls";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Studio" };

// The studio's front page: what you have, and the quickest way to add to it.
//
// Read tier - any member of the partner can see this. The write buttons are
// hidden from read-only staff, but that is courtesy: the pages and actions they
// point at guard themselves.

export default async function PartnerStudioPage({
  params,
}: {
  params: { slug: string };
}) {
  const { partner, canWrite, isRnlStaff } = await requirePartnerUser(params.slug);

  const hasEvents = partnerHasFeature(partner, "events");
  const hasBlog = partnerHasFeature(partner, "blog");
  const hasCareers = partnerHasFeature(partner, "careers");

  // Counted in one round trip, and every count is scoped to this partner. A
  // count that forgot its scope would quietly report RNL's numbers as theirs.
  const [shows, drafts, posts, roles, newApplications] = await Promise.all([
    hasEvents
      ? prisma.event.count({
          where: { partnerId: partner.slug, status: "PUBLISHED" },
        })
      : 0,
    hasEvents
      ? prisma.event.count({
          where: { partnerId: partner.slug, status: "DRAFT" },
        })
      : 0,
    hasBlog
      ? prisma.post.count({
          where: { partnerId: partner.slug, status: "PUBLISHED" },
        })
      : 0,
    hasCareers
      ? prisma.career.count({
          where: { partnerId: partner.slug, status: "OPEN" },
        })
      : 0,
    hasCareers
      ? prisma.application.count({
          where: { partnerId: partner.slug, status: "NEW" },
        })
      : 0,
  ]);

  const base = partnerPortalPath(partner.slug, "/studio");

  return (
    <div>
      <div className="mb-8 border-b border-line pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
          Studio
        </p>
        <h1 className="display mt-3 text-5xl">Your site</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Everything on{" "}
          <a
            href={partnerOrigin(partner.slug)}
            className="text-fg underline underline-offset-4 hover:text-accent"
          >
            {partnerOrigin(partner.slug).replace(/^https?:\/\//, "")}
          </a>{" "}
          is edited from here. Drafts stay hidden until you publish them.
        </p>

        {isRnlStaff ? (
          <p className="mt-4 rounded-brand border border-line bg-elev px-4 py-2.5 text-xs text-muted">
            You&apos;re in as{" "}
            <span className="font-semibold text-fg">RO. Nation LIVE staff</span>,
            not as a member of this partner. Anything you change here is theirs.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {hasEvents ? (
          <Card
            href={`${base}/events`}
            label="Shows"
            value={shows}
            note={drafts ? `${drafts} draft${drafts === 1 ? "" : "s"}` : "Live"}
            cta={canWrite ? "Add a show" : undefined}
            ctaHref={`${base}/events/new`}
          />
        ) : null}

        {hasBlog ? (
          <Card
            href={`${base}/blog`}
            label="Blog"
            value={posts}
            note="Published"
            cta={canWrite ? "Write a post" : undefined}
            ctaHref={`${base}/blog/new`}
          />
        ) : null}

        {hasCareers ? (
          <>
            <Card
              href={`${base}/careers`}
              label="Open roles"
              value={roles}
              note="Accepting applications"
              cta={canWrite ? "Post a role" : undefined}
              ctaHref={`${base}/careers/new`}
            />
            <Card
              href={`${base}/applications`}
              label="New applications"
              value={newApplications}
              note={newApplications ? "Waiting on you" : "Nothing new"}
            />
          </>
        ) : null}

        <Card
          href={`${base}/content`}
          label="Homepage"
          value={null}
          note="Hero, about panel and FAQ"
          cta={canWrite ? "Edit copy" : undefined}
          ctaHref={`${base}/content`}
        />
      </div>
    </div>
  );
}

function Card({
  href,
  label,
  value,
  note,
  cta,
  ctaHref,
}: {
  href: string;
  label: string;
  /** null renders the tile without a number - not every section counts to something. */
  value: number | null;
  note: string;
  cta?: string;
  ctaHref?: string;
}) {
  return (
    <div className="card flex flex-col justify-between p-6">
      <Link href={href} className="group">
        <p className="text-[11px] font-semibold uppercase tracking-kicker text-faint">
          {label}
        </p>
        {value === null ? (
          <p className="display mt-3 text-2xl transition-colors group-hover:text-accent">
            Edit
          </p>
        ) : (
          <p className="tnum display mt-3 text-5xl transition-colors group-hover:text-accent">
            {value}
          </p>
        )}
        <p className="mt-1 text-xs text-muted">{note}</p>
      </Link>

      {cta && ctaHref ? (
        <Link
          href={ctaHref}
          className="mt-6 text-sm font-semibold text-accent transition-colors hover:text-fg"
        >
          {cta} →
        </Link>
      ) : null}
    </div>
  );
}

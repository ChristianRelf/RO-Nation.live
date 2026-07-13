import Link from "next/link";
import { RosterOverview } from "@/components/roster-overview";
import { requireScopeUser } from "@/lib/portal-scope";
import { partnerBySlug } from "@/lib/partners/registry";
import { partnerOrigin, partnerPortalPath } from "@/lib/partners/urls";

export const dynamic = "force-dynamic";

export default async function PartnerOverviewPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { q?: string; error?: string };
}) {
  const { scope, canWrite, actor } = await requireScopeUser(params.slug);
  const partner = partnerBySlug(params.slug);

  return (
    <div>
      <RosterOverview
        scope={scope}
        canWrite={canWrite}
        actorName={actor.displayName}
        searchParams={searchParams}
      />

      {/* Shown under the roster, not above it: the lists are what this portal is
          used for day to day, and the site is edited far less often. */}
      {partner && !searchParams.q ? (
        <div className="mt-10 card flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-xl uppercase">Your site</h2>
            <p className="mt-1 text-sm text-muted">
              Shows, blog, careers and the words on your homepage.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <a
              href={partnerOrigin(partner.slug)}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-muted transition-colors hover:text-fg"
            >
              View site ↗
            </a>
            <Link
              href={partnerPortalPath(partner.slug, "/studio")}
              className="btn btn-ghost py-2.5"
            >
              Open studio
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { RosterOverview } from "@/components/roster-overview";
import { requireScopeUser, SHASHA_SCOPE } from "@/lib/portal-scope";

export const dynamic = "force-dynamic";

export default async function PortalOverviewPage({
  searchParams,
}: {
  searchParams: { q?: string; error?: string };
}) {
  const { scope, canWrite, actor } = await requireScopeUser(SHASHA_SCOPE);
  return (
    <RosterOverview
      scope={scope}
      canWrite={canWrite}
      actorName={actor.displayName}
      searchParams={searchParams}
    />
  );
}

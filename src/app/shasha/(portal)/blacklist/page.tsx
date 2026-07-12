import type { Metadata } from "next";
import { RosterPage, type RosterSearchParams } from "@/components/roster-page";
import { requireScopeUser, SHASHA_SCOPE } from "@/lib/portal-scope";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Blacklist" };

export default async function BlacklistPage({
  searchParams,
}: {
  searchParams: RosterSearchParams;
}) {
  const { scope, canWrite } = await requireScopeUser(SHASHA_SCOPE);
  return (
    <RosterPage
      scope={scope}
      kind="BLACKLIST"
      canWrite={canWrite}
      searchParams={searchParams}
    />
  );
}

import type { Metadata } from "next";
import { RosterPage, type RosterSearchParams } from "@/components/roster-page";
import { requireScopeUser } from "@/lib/portal-scope";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Blacklist" };

export default async function PartnerBlacklistPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: RosterSearchParams;
}) {
  const { scope, canWrite } = await requireScopeUser(params.slug);
  return (
    <RosterPage
      scope={scope}
      kind="BLACKLIST"
      canWrite={canWrite}
      searchParams={searchParams}
    />
  );
}

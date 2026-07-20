import type { Metadata } from "next";
import { RosterAudit } from "@/components/roster-audit";
import { ScopeActivity } from "@/components/portal/scope-activity";
import { requireScopeUser } from "@/lib/portal-scope";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "History" };

export default async function PartnerAuditPage({
  params,
}: {
  params: { slug: string };
}) {
  const { scope } = await requireScopeUser(params.slug);
  return (
    <>
      <RosterAudit scope={scope} />
      <ScopeActivity scope={scope} />
    </>
  );
}

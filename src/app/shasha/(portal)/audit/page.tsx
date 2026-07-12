import type { Metadata } from "next";
import { RosterAudit } from "@/components/roster-audit";
import { requireScopeUser, SHASHA_SCOPE } from "@/lib/portal-scope";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "History" };

export default async function AuditPage() {
  const { scope } = await requireScopeUser(SHASHA_SCOPE);
  return <RosterAudit scope={scope} />;
}

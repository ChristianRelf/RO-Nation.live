import type { Metadata } from "next";
import { ScopeAnalytics } from "@/components/portal/scope-analytics";
import { requireScopeUser, SHASHA_SCOPE } from "@/lib/portal-scope";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Analytics" };

// RNL's own numbers. SHASHA always has shows (the NULL-partnered line-up), so
// there is no feature to assert - the same dashboard, pointed at scope NULL.
export default async function ShashaAnalyticsPage() {
  const { scope } = await requireScopeUser(SHASHA_SCOPE);
  return <ScopeAnalytics scope={scope} />;
}

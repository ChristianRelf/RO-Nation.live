import type { Metadata } from "next";
import { ScopeSettlement } from "@/components/portal/scope-settlement";
import { requireScopeManager, SHASHA_SCOPE } from "@/lib/portal-scope";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payouts" };

export default async function ShashaPayoutsPage() {
  const { scope } = await requireScopeManager(SHASHA_SCOPE);
  return <ScopeSettlement scope={scope} />;
}

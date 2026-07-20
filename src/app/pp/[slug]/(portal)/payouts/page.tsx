import type { Metadata } from "next";
import { ScopeSettlement } from "@/components/portal/scope-settlement";
import { requireScopeManager } from "@/lib/portal-scope";
import { partnerBySlug } from "@/lib/partners/registry";
import { assertPartnerFeature } from "@/lib/partners/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payouts" };

export default async function PartnerPayoutsPage({
  params,
}: {
  params: { slug: string };
}) {
  // Managers only - it is a financial statement.
  const { scope } = await requireScopeManager(params.slug);

  const partner = partnerBySlug(params.slug);
  if (partner) assertPartnerFeature(partner, "events");

  return <ScopeSettlement scope={scope} />;
}

import type { Metadata } from "next";
import { ScopeAnalytics } from "@/components/portal/scope-analytics";
import { requireScopeUser } from "@/lib/portal-scope";
import { partnerBySlug } from "@/lib/partners/registry";
import { assertPartnerFeature } from "@/lib/partners/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Analytics" };

export default async function PartnerAnalyticsPage({
  params,
}: {
  params: { slug: string };
}) {
  const { scope } = await requireScopeUser(params.slug);

  // A partner with no shows has no analytics to have. 404 rather than render an
  // empty page - the registry's rule that a feature a partner lacks "must 404, not
  // just hide its nav item", so the route cannot be reached by typing the URL.
  const partner = partnerBySlug(params.slug);
  if (partner) assertPartnerFeature(partner, "events");

  return <ScopeAnalytics scope={scope} />;
}

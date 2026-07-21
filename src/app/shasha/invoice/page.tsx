import type { Metadata } from "next";
import { PayoutInvoice } from "@/components/portal/payout-invoice";
import { requireScopeManager, SHASHA_SCOPE } from "@/lib/portal-scope";
import { getSettlement } from "@/lib/settlement";
import { parseInvoicePeriod } from "@/lib/invoice-period";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Revenue statement",
  robots: { index: false, follow: false },
};

// RNL's own revenue statement, for its NULL-partnered shows. Sits OUTSIDE the
// (portal) group - like /shasha/login - so it renders bare and prints clean. RNL has
// no external payee for its own shows, so this is the "self" variant: gross minus
// Roblox's 30%, ending in what RNL keeps, with no platform fee.
export default async function ShashaInvoicePage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const { scope } = await requireScopeManager(SHASHA_SCOPE);

  const { range, label, tag } = parseInvoicePeriod(searchParams.period);
  const settlement = await getSettlement(scope.eventScope, range);

  return (
    <PayoutInvoice
      variant="self"
      payeeName="RO. Nation LIVE"
      periodLabel={label}
      invoiceNo={`RNL-SHASHA-${tag}`}
      generatedOn={new Date()}
      settlement={settlement}
      backHref={`${scope.basePath}/payouts`}
    />
  );
}

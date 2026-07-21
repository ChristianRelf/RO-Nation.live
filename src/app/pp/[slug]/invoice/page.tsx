import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PayoutInvoice } from "@/components/portal/payout-invoice";
import { requireScopeManager } from "@/lib/portal-scope";
import { partnerBySlug } from "@/lib/partners/registry";
import { assertPartnerFeature } from "@/lib/partners/guard";
import { getSettlement } from "@/lib/settlement";
import { parseInvoicePeriod } from "@/lib/invoice-period";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Payout statement",
  robots: { index: false, follow: false },
};

export default async function PartnerInvoicePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { period?: string };
}) {
  // Managers only - it is a financial document.
  const { scope } = await requireScopeManager(params.slug);

  // Invoices are for PARTNERS (a payee RNL owes). RNL's own shows have no external
  // party to pay, so this route does not exist for SHASHA.
  if (!scope.eventScope) notFound();

  const partner = partnerBySlug(params.slug);
  if (partner) assertPartnerFeature(partner, "events");

  const { range, label, tag } = parseInvoicePeriod(searchParams.period);
  const settlement = await getSettlement(scope.eventScope, range);

  return (
    <PayoutInvoice
      variant="partner"
      payeeName={scope.name}
      periodLabel={label}
      invoiceNo={`RNL-${scope.id.toUpperCase()}-${tag}`}
      generatedOn={new Date()}
      settlement={settlement}
      backHref={`${scope.basePath}/payouts`}
    />
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PayoutInvoice } from "@/components/portal/payout-invoice";
import { requireScopeManager } from "@/lib/portal-scope";
import { partnerBySlug } from "@/lib/partners/registry";
import { assertPartnerFeature } from "@/lib/partners/guard";
import { getSettlement, type SettlementRange } from "@/lib/settlement";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Payout statement",
  robots: { index: false, follow: false },
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-07" → a month window and a label; anything else → all-time. */
function parsePeriod(raw?: string): {
  range?: SettlementRange;
  label: string;
  tag: string;
} {
  const m = /^(\d{4})-(\d{2})$/.exec(raw ?? "");
  if (!m) return { label: "All time", tag: "ALL" };

  const year = Number(m[1]);
  const month = Number(m[2]); // 1-12
  if (month < 1 || month > 12) return { label: "All time", tag: "ALL" };

  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1); // exclusive: first of the next month
  return {
    range: { from, to },
    label: `${MONTHS[month - 1]} ${year}`,
    tag: `${m[1]}-${m[2]}`,
  };
}

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

  const { range, label, tag } = parsePeriod(searchParams.period);
  const settlement = await getSettlement(scope.eventScope, range);

  return (
    <PayoutInvoice
      partnerName={scope.name}
      periodLabel={label}
      invoiceNo={`RNL-${scope.id.toUpperCase()}-${tag}`}
      generatedOn={new Date()}
      settlement={settlement}
      backHref={`${scope.basePath}/payouts`}
    />
  );
}

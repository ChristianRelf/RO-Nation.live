import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PayoutInvoice } from "@/components/portal/payout-invoice";
import { requireScopeManager } from "@/lib/portal-scope";
import { partnerBySlug } from "@/lib/partners/registry";
import { assertPartnerFeature } from "@/lib/partners/guard";
import {
  getSentInvoiceForPartner,
  markInvoiceOpened,
  settlementFromInvoice,
} from "@/lib/invoices";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Payout statement",
  robots: { index: false, follow: false },
};

// A partner reading one payout statement RNL issued to them. Read-only by construction -
// there is no generate here and no send; the partner cannot mint invoices, only open the
// ones sent to them (see lib/invoices and the Invoice model note). It renders the FROZEN
// snapshot, reconstructed into a Settlement, so what the partner sees is exactly what was
// issued - not a live recount that could have moved since.
//
// Sits OUTSIDE the (portal) group, like the old self-serve route did, so it is the whole
// page and prints clean.
export default async function PartnerInvoicePage({
  params,
}: {
  params: { slug: string; invoiceid: string };
}) {
  // Managers only - it is a financial document. requireScopeManager 404s a stranger and
  // bounces read-only staff, so the guard doubles as the "is this your portal" check.
  const { scope } = await requireScopeManager(params.slug);

  const partner = partnerBySlug(params.slug);
  if (partner) assertPartnerFeature(partner, "events");

  // Scoped to this partner AND to SENT: a draft, or an id belonging to another partner,
  // both resolve to null. A partner can only open what has actually been issued to them.
  const invoice = await getSentInvoiceForPartner(scope.id, params.invoiceid);
  if (!invoice) notFound();

  // The first open stamps openedAt, which is what clears the "new invoice" indicator on
  // their payouts page. Awaited but never throwing - a failed stamp must not stop them
  // reading the document.
  await markInvoiceOpened(invoice.id);

  return (
    <PayoutInvoice
      variant="partner"
      payeeName={invoice.payeeName}
      periodLabel={invoice.periodLabel}
      invoiceNo={invoice.number}
      generatedOn={invoice.issuedAt}
      settlement={settlementFromInvoice(invoice)}
      backHref={`${scope.basePath}/payouts`}
    />
  );
}

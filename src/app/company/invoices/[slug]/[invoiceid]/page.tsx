import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCompanyUser } from "@/lib/company";
import { PayoutInvoice } from "@/components/portal/payout-invoice";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { getInvoiceForCompany, settlementFromInvoice } from "@/lib/invoices";
import { issueInvoice } from "@/app/actions/invoices";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

// The company's view of one invoice - the same printable document the partner will see,
// plus the two things only the company gets: a Draft/Sent badge, and the Send button while
// it is still a draft. Both live in the document's no-print toolbar, so neither reaches
// paper. It reads the FROZEN row and reconstructs a Settlement from it (never a live
// ledger read), so the company sees exactly what it issued.
export default async function CompanyInvoiceDocumentPage({
  params,
}: {
  params: { slug: string; invoiceid: string };
}) {
  await requireCompanyUser();

  // Scoped to the partner in the URL: a good id under the wrong partner resolves to
  // nothing, so one partner's document can never render under another's heading.
  const invoice = await getInvoiceForCompany(params.slug, params.invoiceid);
  if (!invoice) notFound();

  const isDraft = invoice.status === "DRAFT";

  return (
    <PayoutInvoice
      variant="partner"
      payeeName={invoice.payeeName}
      periodLabel={invoice.periodLabel}
      invoiceNo={invoice.number}
      generatedOn={invoice.issuedAt}
      settlement={settlementFromInvoice(invoice)}
      backHref={`/company/invoices/${params.slug}`}
      backLabel="Back to invoices"
      statusBadge={<InvoiceStatusBadge status={invoice.status} tone="light" />}
      actions={
        isDraft ? (
          <form action={issueInvoice}>
            <input type="hidden" name="slug" value={params.slug} />
            <input type="hidden" name="id" value={invoice.id} />
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-80"
            >
              Send to partner
            </button>
          </form>
        ) : null
      }
    />
  );
}

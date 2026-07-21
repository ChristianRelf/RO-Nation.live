import type { Metadata } from "next";
import Link from "next/link";
import { requireCompanyUser } from "@/lib/company";
import { CompanyShell } from "@/components/company-shell";
import { AdminHeader } from "@/components/admin-ui";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { activePartners, partnerHasFeature } from "@/lib/partners/registry";
import { listAllInvoices } from "@/lib/invoices";
import { formatRobux } from "@/lib/tickets/pricing";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invoices" };

// The company's invoice desk. Pick a partner to generate a payout statement for, and
// see every statement issued so far, across all of them. The document itself lives one
// level deeper - this page never renders money, only points at it.
export default async function CompanyInvoicesPage() {
  const user = await requireCompanyUser();

  // Invoices are about ticket sales, so only partners who actually run events can have
  // one. SHASHA (RNL's own revenue) is not here at all: there is no external party to pay.
  const partners = activePartners().filter((p) => partnerHasFeature(p, "events"));
  const invoices = await listAllInvoices();

  return (
    <CompanyShell user={user}>
      <AdminHeader
        title="Invoices"
        subtitle="Payout statements RO. Nation LIVE issues to partners. Generate one from a partner's ledger, then send it - the partner reads it in their portal."
      />

      <section className="mb-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          Generate for a partner
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {partners.map((p) => (
            <Link
              key={p.slug}
              href={`/company/invoices/${p.slug}`}
              className="card flex items-center justify-between gap-4 p-4 transition-colors hover:border-accent/50"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-fg">{p.name}</p>
                <p className="truncate text-xs text-muted">{p.slug}</p>
              </div>
              <span className="shrink-0 text-sm text-accent">Open →</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          All invoices
        </h2>

        {invoices.length ? (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-5 py-3 font-semibold">Number</th>
                    <th className="px-5 py-3 font-semibold">Partner</th>
                    <th className="px-5 py-3 font-semibold">Period</th>
                    <th className="px-5 py-3 text-right font-semibold">Payable</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Issued</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-fg/[0.02]">
                      <td className="px-5 py-4">
                        <Link
                          href={`/company/invoices/${inv.partnerId}/${inv.id}`}
                          className="font-medium tabular-nums text-fg hover:text-accent"
                        >
                          {inv.number}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-muted">{inv.payeeName}</td>
                      <td className="px-5 py-4 text-muted">{inv.periodLabel}</td>
                      <td className="px-5 py-4 text-right tabular-nums font-semibold text-fg">
                        {formatRobux(inv.partnerPayout)}
                      </td>
                      <td className="px-5 py-4">
                        <InvoiceStatusBadge status={inv.status} />
                      </td>
                      <td className="px-5 py-4 text-muted">{formatDate(inv.issuedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card p-6 text-sm text-muted">
            No invoices yet. Pick a partner above to generate their first payout statement.
          </div>
        )}
      </section>
    </CompanyShell>
  );
}

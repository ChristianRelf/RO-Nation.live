import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCompanyUser } from "@/lib/company";
import { CompanyShell } from "@/components/company-shell";
import { AdminHeader } from "@/components/admin-ui";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { partnerBySlug, partnerHasFeature } from "@/lib/partners/registry";
import { listInvoicesForPartner } from "@/lib/invoices";
import { parseInvoicePeriod } from "@/lib/invoice-period";
import { generateInvoice } from "@/app/actions/invoices";
import { formatRobux } from "@/lib/tickets/pricing";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const partner = partnerBySlug(params.slug);
  return { title: partner ? `${partner.name} invoices` : "Invoices" };
}

const MESSAGES: Record<string, string> = {
  partner: "That isn't a partner we can invoice.",
  noevents: "That partner doesn't run events, so there's nothing to invoice.",
  missing: "That invoice no longer exists.",
};

const OK: Record<string, string> = {
  sent: "Invoice sent. It's now in the partner's portal.",
};

// The last twelve months, plus all-time, as period choices. Labels come from
// parseInvoicePeriod so the dropdown and the generated invoice can't disagree on what a
// tag means. Built on the server; the client only ever posts the tag back.
function periodOptions() {
  const now = new Date();
  const opts = [{ value: "", label: "All time" }];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const tag = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    opts.push({ value: tag, label: parseInvoicePeriod(tag).label });
  }
  return opts;
}

export default async function CompanyPartnerInvoicesPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { ok?: string; error?: string };
}) {
  const user = await requireCompanyUser();

  // Through the registry, never straight to a query - an invented slug is a 404, and a
  // partner without events cannot be invoiced (an invoice is a statement about ticket
  // sales). Same guard the generate action re-runs server-side.
  const partner = partnerBySlug(params.slug);
  if (!partner || !partnerHasFeature(partner, "events")) notFound();

  const invoices = await listInvoicesForPartner(partner.slug);
  const options = periodOptions();

  return (
    <CompanyShell user={user}>
      <AdminHeader
        title={`${partner.name} — invoices`}
        subtitle="Generate a payout statement from this partner's ledger, then send it. Figures are frozen the moment you generate; sending makes it readable in their portal."
      />

      <p className="mb-6 text-sm">
        <Link href="/company/invoices" className="text-muted hover:text-fg">
          ← All invoices
        </Link>
      </p>

      {searchParams.error ? (
        <p className="mb-6 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {MESSAGES[searchParams.error] ?? "That didn't work."}
        </p>
      ) : null}
      {searchParams.ok ? (
        <p className="mb-6 border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
          {OK[searchParams.ok] ?? "Done."}
        </p>
      ) : null}

      {/* Generate - one period, one click, lands on the draft document. */}
      <form
        action={generateInvoice}
        className="card mb-10 flex flex-col gap-4 p-5 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="slug" value={partner.slug} />
        <label className="flex-1">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Billing period
          </span>
          <select
            name="period"
            defaultValue={options[1]?.value ?? ""}
            className="w-full rounded-lg border border-line bg-elev px-3 py-2 text-sm text-fg"
          >
            {options.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-accent shrink-0">
          Generate draft
        </button>
      </form>

      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
        Issued for {partner.name}
      </h2>

      {invoices.length ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-semibold">Number</th>
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
                        href={`/company/invoices/${partner.slug}/${inv.id}`}
                        className="font-medium tabular-nums text-fg hover:text-accent"
                      >
                        {inv.number}
                      </Link>
                    </td>
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
          Nothing issued yet. Generate a draft above - it stays private to the company
          until you send it.
        </div>
      )}
    </CompanyShell>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DocumentStatus } from "@prisma/client";
import { requirePartnerAccount, isFullPartner } from "@/lib/partner-account";
import { listDocumentsForPartnerAccount } from "@/lib/accounting/documents";
import { kindConfig } from "@/lib/accounting/kinds";
import { formatRobux } from "@/lib/tickets/pricing";
import { formatDate } from "@/lib/format";
import { env } from "@/lib/env";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Accounting" };

const STATUS_LABEL: Record<DocumentStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  PAID: "Paid",
  VOID: "Void",
};

export default async function PartnerAccountingPage() {
  const user = await requirePartnerAccount();
  // The lock, not just the hidden nav item: a potential partner who deep-links here is sent
  // back to the overview with a note. isFullPartner mirrors the Accounting tab's own gate.
  if (!isFullPartner(user.account)) redirect("/partner?notice=accounting");

  const docs = await listDocumentsForPartnerAccount(user.account.id);

  return (
    <div className="mx-auto max-w-4xl">
      <Kicker>Accounting</Kicker>
      <h1 className="display mt-4 text-4xl leading-none sm:text-5xl">Your documents</h1>
      <p className="mt-4 max-w-xl text-muted">
        Every document RO. Nation LIVE has raised with {user.account.name} - payouts,
        billables, receipts and credit notes. Open one to read or print it.
      </p>

      {docs.length === 0 ? (
        <div className="card mt-10 p-8 text-center">
          <p className="text-muted">Nothing here yet.</p>
          <p className="mt-2 text-sm text-faint">
            When we raise a payout, invoice, receipt or credit note with you, it appears here.
          </p>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-kicker text-faint">
                <th className="py-3 pr-4 font-semibold">Document</th>
                <th className="py-3 pr-4 font-semibold">For</th>
                <th className="py-3 pr-4 font-semibold">Date</th>
                <th className="py-3 pr-4 text-right font-semibold">Amount</th>
                <th className="py-3 pr-4 font-semibold">Status</th>
                <th className="py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-b border-line/60">
                  <td className="py-3 pr-4">
                    <span className="block font-medium text-fg">
                      {kindConfig(d.kind).heading}
                    </span>
                    <span className="block font-mono text-[11px] text-faint">
                      {d.number ?? "—"}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-muted">{d.title}</td>
                  <td className="py-3 pr-4 text-muted">{formatDate(d.documentDate)}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {formatRobux(d.total)}
                  </td>
                  <td className="py-3 pr-4 text-muted">{STATUS_LABEL[d.status]}</td>
                  <td className="py-3">
                    {d.shareToken ? (
                      <a
                        href={`${env.siteUrl}/doc/${d.shareToken}`}
                        target="_blank"
                        rel="noreferrer"
                        className="link-underline text-accent transition-colors hover:text-fg"
                      >
                        View
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { DocumentStatus } from "@prisma/client";
import { requireCompanyUser } from "@/lib/company";
import { AccountingShell } from "@/components/accounting/accounting-shell";
import { AdminHeader, StatCard } from "@/components/admin-ui";
import { DocumentStatusBadge } from "@/components/accounting/document-status-badge";
import { LocalTime } from "@/components/local-time";
import { formatRobux } from "@/lib/tickets/pricing";
import {
  ALL_DOCUMENT_KINDS,
  DOCUMENT_KINDS,
  kindConfig,
  parseKind,
  STATUS_META,
} from "@/lib/accounting/kinds";
import { accountingSummary, listDocuments } from "@/lib/accounting/documents";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Accounting" };

const OK: Record<string, string> = {
  discarded: "Draft discarded.",
};

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: DocumentStatus.DRAFT, label: "Drafts" },
  { value: DocumentStatus.ISSUED, label: "Issued" },
  { value: DocumentStatus.PAID, label: "Paid" },
  { value: DocumentStatus.VOID, label: "Void" },
];

/**
 * The accounting desk.
 *
 * Two halves, and the split is the point. The top is what RNL's own money is doing -
 * owed, owing, settled - and a way to start each kind of document. The bottom is the
 * register: every document ever written, filterable.
 *
 * Payout invoices are deliberately a LINK out rather than rows in this table. They are a
 * different animal - generated from the ticket ledger, never typed, delivered through a
 * partner's portal - and folding them in would suggest you can edit one here. You
 * cannot, and you never should be able to.
 */
export default async function CompanyAccountingPage({
  searchParams,
}: {
  searchParams: { kind?: string; status?: string; ok?: string };
}) {
  const user = await requireCompanyUser();

  const kind = parseKind(searchParams.kind) ?? undefined;
  const status =
    searchParams.status && searchParams.status in STATUS_META
      ? (searchParams.status as DocumentStatus)
      : undefined;

  const [summary, documents] = await Promise.all([
    accountingSummary(),
    listDocuments({ kind, status }),
  ]);

  const query = (next: { kind?: string; status?: string }) => {
    const params = new URLSearchParams();
    const k = next.kind ?? kind ?? "";
    const st = next.status ?? status ?? "";
    if (k) params.set("kind", k);
    if (st) params.set("status", st);
    const qs = params.toString();
    return `/company/accounting${qs ? `?${qs}` : ""}`;
  };

  return (
    <AccountingShell user={user}>
      <AdminHeader
        title="Accounting"
        subtitle="Documents for the money the ticket ledger doesn't cover — billing a sponsor, paying a contractor, receipting and correcting either. Every figure is in Robux."
      />

      {searchParams.ok ? (
        <p className="mb-6 border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
          {OK[searchParams.ok] ?? "Done."}
        </p>
      ) : null}

      {/* ---- Where the money stands ------------------------------------- */}
      <section className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Owed to us"
          value={formatRobux(summary.owedToUs)}
          hint="Issued invoices, less credit notes"
        />
        <StatCard
          label="Owed by us"
          value={formatRobux(summary.owedByUs)}
          hint="Payment advices and refunds, unsettled"
        />
        <StatCard
          label="Received this year"
          value={formatRobux(summary.receivedYtd)}
          hint="Receipts marked paid"
        />
        <StatCard
          label="Paid out this year"
          value={formatRobux(summary.paidYtd)}
          hint={
            summary.refundedYtd
              ? `Incl. ${formatRobux(summary.refundedYtd)} refunded`
              : "Contractor payments and refunds settled"
          }
        />
      </section>

      {/* ---- Start something -------------------------------------------- */}
      <section className="mb-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          New document
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {DOCUMENT_KINDS.map((k) => (
            <Link
              key={k.kind}
              href={`/company/accounting/new?kind=${k.kind}`}
              className="card flex items-start justify-between gap-4 p-4 transition-colors hover:border-accent/50"
            >
              <div className="min-w-0">
                <p className="font-semibold text-fg">{k.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{k.hint}</p>
              </div>
              <span className="shrink-0 text-sm text-accent">New →</span>
            </Link>
          ))}
        </div>

        {/* Set apart from the four cards above, and worded as the exception it is.
            A refund sitting in the grid as a fifth equal option is an invitation; it
            belongs on the page, but not as one of the things you routinely do. */}
        <Link
          href="/company/accounting/refund"
          className="card mt-3 flex items-start justify-between gap-4 border-amber-400/20 p-4 transition-colors hover:border-amber-400/50"
        >
          <div className="min-w-0">
            <p className="font-semibold text-fg">Refund a ticket</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Exceptional cases only. Written against the ticket, capped at what the
              holder actually paid.
            </p>
          </div>
          <span className="shrink-0 text-sm text-amber-300">Open →</span>
        </Link>

        <Link
          href="/company/invoices"
          className="card mt-3 flex items-center justify-between gap-4 p-4 transition-colors hover:border-accent/50"
        >
          <div className="min-w-0">
            <p className="font-semibold text-fg">Partner payout statements</p>
            <p className="mt-1 text-xs text-muted">
              Generated from the ticket ledger, not written by hand. Separate desk.
            </p>
          </div>
          <span className="shrink-0 text-sm text-accent">Open →</span>
        </Link>
      </section>

      {/* ---- The register ------------------------------------------------ */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
            All documents
            {summary.draftCount ? (
              <span className="ml-2 text-faint">
                · {summary.draftCount} draft{summary.draftCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </h2>
        </div>

        {/* Filters. Plain links, so a filtered view is a URL you can keep. */}
        <div className="mb-4 flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            <FilterPill href={query({ kind: "" })} active={!kind} label="All types" />
            {/* Every kind here, including refunds - you must be able to FIND a refund
                even though you don't START one from the cards above. */}
            {ALL_DOCUMENT_KINDS.map((k) => (
              <FilterPill
                key={k.kind}
                href={query({ kind: k.kind })}
                active={kind === k.kind}
                label={k.label}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_TABS.map((t) => (
              <FilterPill
                key={t.value || "all"}
                href={query({ status: t.value })}
                active={(status ?? "") === t.value}
                label={t.label}
              />
            ))}
          </div>
        </div>

        {documents.length ? (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-5 py-3 font-semibold">Number</th>
                    <th className="px-5 py-3 font-semibold">Type</th>
                    <th className="px-5 py-3 font-semibold">Party</th>
                    <th className="px-5 py-3 font-semibold">For</th>
                    <th className="px-5 py-3 text-right font-semibold">Total</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Dated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {documents.map((d) => {
                    const cfg = kindConfig(d.kind);
                    return (
                      <tr key={d.id} className="hover:bg-fg/[0.02]">
                        <td className="px-5 py-4">
                          <Link
                            href={`/company/accounting/${d.id}`}
                            className="font-medium tabular-nums text-fg hover:text-accent"
                          >
                            {d.number ?? "Draft"}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-muted">{cfg.label}</td>
                        <td className="px-5 py-4 text-muted">{d.counterpartyName}</td>
                        <td className="max-w-[16rem] truncate px-5 py-4 text-muted">
                          {d.title}
                        </td>
                        <td
                          className={`px-5 py-4 text-right font-semibold tabular-nums ${
                            cfg.direction === "outbound" ? "text-amber-300" : "text-fg"
                          }`}
                        >
                          {cfg.direction === "outbound" ? "− " : ""}
                          {formatRobux(d.total)}
                        </td>
                        <td className="px-5 py-4">
                          <DocumentStatusBadge status={d.status} />
                        </td>
                        <td className="px-5 py-4 text-muted">
                          <LocalTime value={d.documentDate} mode="date" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card p-6 text-sm text-muted">
            {kind || status
              ? "Nothing matches that filter."
              : "No documents yet. Start one above — it stays a private draft until you issue it."}
          </div>
        )}
      </section>
    </AccountingShell>
  );
}

function FilterPill({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-accent-soft text-accent ring-1 ring-inset ring-accent/30"
          : "text-muted hover:bg-surface/60 hover:text-fg"
      }`}
    >
      {label}
    </Link>
  );
}

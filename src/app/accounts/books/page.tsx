import type { Metadata } from "next";
import Link from "next/link";
import { requireCompanyUser } from "@/lib/company";
import { AccountingShell } from "@/components/accounting/accounting-shell";
import { AdminHeader, StatCard } from "@/components/admin-ui";
import { formatRobux } from "@/lib/tickets/pricing";
import { books } from "@/lib/accounting/documents";
import { openRequestCount } from "@/lib/accounting/requests";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Books" };

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * The books - a year of documents, by month.
 *
 * The desk answers "what is outstanding right now". This answers "what happened", which
 * is a different question and needs a different shape: a period, twelve rows, and four
 * columns that do not move once the month is over.
 *
 * ---- What this is not -----------------------------------------------------
 *
 * It is not an accounting package and does not pretend to be one. There is no
 * double-entry, no chart of accounts, no reconciliation against a bank feed - RNL's money
 * is Robux and there is no bank feed to reconcile against. What it is: an honest,
 * checkable summary of every document RNL has issued, in the period it belongs to, which
 * is the thing somebody actually needs when they are asked what the company took last
 * quarter.
 *
 * Drafts and voids are absent by construction - see books() for why that is a rule about
 * what a set of books IS, not a filter somebody chose.
 */
export default async function BooksPage({
  searchParams,
}: {
  searchParams: { year?: string };
}) {
  const user = await requireCompanyUser();

  // A bad ?year falls back to this year rather than 404ing. Unlike ?kind on the builder -
  // where defaulting would mint the wrong document - the worst case here is looking at the
  // wrong twelve rows, and the picker is right there.
  const parsed = Number.parseInt(searchParams.year ?? "", 10);
  const year =
    Number.isFinite(parsed) && parsed >= 2000 && parsed <= 2999
      ? parsed
      : new Date().getFullYear();

  const [ledger, openRequests] = await Promise.all([books(year), openRequestCount()]);

  // Net is what was billed less what was credited off it. NOT received-minus-paid, which
  // is a cashflow figure and would say something different - both are true, and putting
  // one under a heading meaning the other is how a number gets quoted wrong.
  const netBilled = ledger.totals.invoiced - ledger.totals.credited;

  return (
    <AccountingShell user={user} openRequests={openRequests}>
      <AdminHeader
        title="Books"
        subtitle={`Every document RNL issued in ${year}, by the month it is dated to. Drafts and voided documents are not here - a draft is not a transaction, and a void is a cancelled one.`}
      />

      {/* The year picker. Plain links, so a year is a URL you can keep and send. */}
      <div className="mb-8 flex flex-wrap gap-1.5">
        {ledger.years.map((y) => (
          <Link
            key={y}
            href={`/books?year=${y}`}
            aria-current={y === year ? "page" : undefined}
            className={`rounded-full px-3 py-1 text-xs font-medium tabular-nums transition-colors ${
              y === year
                ? "bg-accent-soft text-accent ring-1 ring-inset ring-accent/30"
                : "text-muted hover:bg-surface/60 hover:text-fg"
            }`}
          >
            {y}
          </Link>
        ))}
      </div>

      <section className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Billed"
          value={formatRobux(ledger.totals.invoiced)}
          hint={
            ledger.totals.credited
              ? `${formatRobux(netBilled)} net of credit notes`
              : "Invoices raised"
          }
        />
        <StatCard
          label="Received"
          value={formatRobux(ledger.totals.received)}
          hint="Receipts issued"
        />
        <StatCard
          label="Paid out"
          value={formatRobux(ledger.totals.paidOut)}
          hint="Payroll slips and refunds"
        />
        <StatCard
          label="Documents"
          value={ledger.totals.count}
          hint={`Issued in ${year}`}
        />
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          By month
        </h2>

        {ledger.totals.count === 0 ? (
          <div className="card p-6 text-sm text-muted">
            Nothing was issued in {year}. Documents appear here the moment they are issued
            - a draft is not on the books.
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <caption className="sr-only">
                  Documents issued in {year}, by month.
                </caption>
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Month
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">
                      Billed
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">
                      Credited
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">
                      Received
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">
                      Paid out
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">
                      Docs
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {ledger.months.map((m) => (
                    <tr
                      key={m.month}
                      /* An empty month is dimmed, not hidden. Twelve rows every year means
                         a gap is visible as a gap - "we invoiced nothing in August" is a
                         fact, and a table that silently omits August cannot state it. */
                      className={m.count ? "hover:bg-fg/[0.02]" : "text-faint"}
                    >
                      <th scope="row" className="px-5 py-3 text-left font-medium">
                        {MONTHS[m.month]}
                      </th>
                      <Money value={m.invoiced} />
                      <Money value={m.credited} tone="muted" />
                      <Money value={m.received} />
                      <Money value={m.paidOut} tone="out" />
                      <td className="px-5 py-3 text-right tabular-nums text-muted">
                        {m.count || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-line font-semibold">
                    <th scope="row" className="px-5 py-3 text-left">
                      {year}
                    </th>
                    <Money value={ledger.totals.invoiced} />
                    <Money value={ledger.totals.credited} tone="muted" />
                    <Money value={ledger.totals.received} />
                    <Money value={ledger.totals.paidOut} tone="out" />
                    <td className="px-5 py-3 text-right tabular-nums">
                      {ledger.totals.count}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        <p className="mt-4 text-xs leading-relaxed text-faint">
          Figures are bucketed by the date on the document, not the date it was issued - a
          slip written in January for December&apos;s work sits in December, which is the
          same month its number came out of. Every figure is in Robux.
        </p>
      </section>
    </AccountingShell>
  );
}

/** A money cell. Zero prints as an em dash: a column of 0s reads as data, and it is not. */
function Money({ value, tone }: { value: number; tone?: "muted" | "out" }) {
  return (
    <td
      className={`px-5 py-3 text-right tabular-nums ${
        !value ? "text-faint" : tone === "out" ? "text-amber-300" : ""
      }`}
    >
      {value ? formatRobux(value) : "-"}
    </td>
  );
}

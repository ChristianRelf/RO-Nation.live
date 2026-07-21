import type { ReactNode } from "react";
import type { Settlement } from "@/lib/settlement";
import { formatRobux } from "@/lib/tickets/pricing";
import { formatDate, formatDateTime } from "@/lib/format";
import { PrintButton } from "./print-button";

// A settlement document, as a printable page. White paper, slate ink, RNL's mark
// top-left - built to be saved as a PDF from the browser (the print button below).
//
// It renders OUTSIDE the portal chrome (see app/pp/[slug]/invoice and
// app/shasha/invoice), so it is the whole page: no nav, no footer, nothing to strip
// when it prints. It forces its own light palette with explicit colours rather than
// theme tokens, because the portal it is reached from is dark and a statement about
// money must look the same on every screen and on paper. The few filled areas (the
// accent rule, the table head, the final total) carry print-color-adjust: exact so
// they survive "Save as PDF" instead of dropping to white.
//
// TWO variants, because the money splits differently:
//
//   partner  A PAYOUT. RNL owes the partner their share - gross, minus Roblox's 30%,
//            minus RNL's 10% platform fee, equals the amount payable to the partner.
//
//   self     RNL's OWN shows (SHASHA). There is no third party to pay and no platform
//            fee to take from anyone, so it is a REVENUE statement: gross, minus
//            Roblox's 30%, equals what RNL keeps.
//
// See lib/settlement.ts for the numbers; both variants read the same payout stack.

export function PayoutInvoice({
  variant,
  payeeName,
  periodLabel,
  invoiceNo,
  generatedOn,
  settlement,
  backHref,
  backLabel = "Back to payouts",
  statusBadge,
  actions,
}: {
  variant: "partner" | "self";
  /** Who the statement is for - the partner, or "RO. Nation LIVE" for its own shows. */
  payeeName: string;
  periodLabel: string;
  invoiceNo: string;
  generatedOn: Date;
  settlement: Settlement;
  backHref: string;
  /** The toolbar's back link text. Defaults to the partner/SHASHA payouts wording. */
  backLabel?: string;
  /** Screen-only chip beside the back link - e.g. a Draft/Sent status. Never prints. */
  statusBadge?: ReactNode;
  /** Screen-only toolbar actions beside Print - e.g. the company's Send button. Never prints. */
  actions?: ReactNode;
}) {
  const { shows, payout, capped } = settlement;
  const isSelf = variant === "self";

  return (
    <div className="inv min-h-dvh bg-slate-100 text-slate-900">
      {/* Print rules: hide the toolbar, drop the desk-grey backdrop to white, keep
          intentional fills, give the page margins, and don't slice a row across a
          page break. */}
      <style>{`
        .inv { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: #ffffff !important; }
          .inv, .sheet { background: #ffffff !important; box-shadow: none !important; }
          .grain::before { display: none !important; }
          tr, section, header, footer { break-inside: avoid; }
        }
        @page { margin: 16mm; }
      `}</style>

      <div className="mx-auto max-w-3xl px-6 py-8 sm:px-8 sm:py-10 print:px-0 print:py-0">
        {/* Toolbar - screen only */}
        <div className="no-print mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <a href={backHref} className="text-sm text-slate-500 hover:text-slate-900">
              ← {backLabel}
            </a>
            {statusBadge}
          </div>
          <div className="flex items-center gap-3">
            {actions}
            <PrintButton />
          </div>
        </div>

        {/* The sheet - a white document sitting on the grey desk (screen); plain white
            on paper. */}
        <div className="sheet overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200 print:rounded-none print:shadow-none print:ring-0">
          {/* Corporate accent rule across the top of the sheet. */}
          <div className="h-1.5 bg-slate-900" />

          <div className="px-8 py-9 sm:px-10">
            {/* Letterhead */}
            <header className="flex items-start justify-between gap-6">
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/brandassets/square/RNL_square_logo_no_fan.jpg"
                  alt="RO. Nation LIVE"
                  width={56}
                  height={56}
                  className="h-14 w-14 shrink-0 rounded object-contain ring-1 ring-slate-200"
                />
                <div>
                  <p className="text-lg font-extrabold uppercase leading-none tracking-tight">
                    RO. Nation LIVE
                  </p>
                  <p className="mt-1 text-xs text-slate-500">ronation.live</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  {isSelf ? "Revenue" : "Payout"}
                </p>
                <h1 className="mt-1 text-2xl font-extrabold uppercase leading-none tracking-tight">
                  Statement
                </h1>
              </div>
            </header>

            {/* Metadata strip - statement no. / issue date / billing period. */}
            <section className="mt-8 grid grid-cols-3 divide-x divide-slate-200 rounded-md border border-slate-200 bg-slate-50 text-sm">
              <Meta label="Statement no." value={invoiceNo} mono />
              <Meta label="Issue date" value={formatDate(generatedOn)} />
              <Meta label="Billing period" value={periodLabel} />
            </section>

            {/* Parties - who issues it, who it is for. */}
            <section className="mt-7 grid grid-cols-2 gap-6 text-sm">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  From
                </p>
                <p className="mt-1.5 text-base font-semibold">RO. Nation LIVE</p>
                <p className="text-xs text-slate-500">ronation.live</p>
              </div>
              <div className="sm:text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {isSelf ? "For" : "Payable to"}
                </p>
                <p className="mt-1.5 text-base font-semibold">{payeeName}</p>
              </div>
            </section>

            {/* Line items - one row per show */}
            <table className="mt-8 w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-900 text-left text-[10px] uppercase tracking-[0.14em] text-slate-100">
                  <th className="rounded-l px-3 py-2.5 font-semibold">Show</th>
                  <th className="px-3 py-2.5 font-semibold">Date</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Paid tickets</th>
                  <th className="rounded-r px-3 py-2.5 text-right font-semibold">Gross</th>
                </tr>
              </thead>
              <tbody>
                {shows.length ? (
                  shows.map((s) => (
                    <tr key={s.eventId} className="border-b border-slate-200">
                      <td className="px-3 py-2.5 font-medium">{s.title}</td>
                      <td className="px-3 py-2.5 text-slate-600">{formatDate(s.startsAt)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{s.payments}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatRobux(s.robux)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                      No paid tickets in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Totals - the fee stack in a boxed summary. The partner variant carries
                RNL's platform fee and ends in the amount payable; the self variant
                stops at what RNL keeps. */}
            <section className="mt-8 flex justify-end">
              <div className="w-full max-w-xs overflow-hidden rounded-md border border-slate-200">
                <dl className="space-y-2 px-4 py-3.5 text-sm">
                  <Line label="Gross (buyers paid)" value={formatRobux(payout.gross)} />
                  <Line label="Roblox fee (30%)" value={`− ${formatRobux(payout.robloxFee)}`} muted />
                  {!isSelf && (
                    <>
                      <Line label="Received by RNL" value={formatRobux(payout.afterRoblox)} />
                      <Line
                        label="RNL platform fee (10%)"
                        value={`− ${formatRobux(payout.rnlFee)}`}
                        muted
                      />
                    </>
                  )}
                </dl>
                <div className="flex items-baseline justify-between gap-4 bg-slate-900 px-4 py-3 text-white">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                    {isSelf ? "Net revenue" : "Amount payable"}
                  </dt>
                  <dd className="text-lg font-extrabold tabular-nums">
                    {formatRobux(isSelf ? payout.afterRoblox : payout.partnerPayout)}
                  </dd>
                </div>
              </div>
            </section>

            {/* Small print */}
            <footer className="mt-12 border-t border-slate-200 pt-4 text-[11px] leading-relaxed text-slate-500">
              <p>
                All ticket revenue is collected by RO. Nation LIVE. Roblox deducts 30% at
                the point of sale
                {isSelf
                  ? "; the balance is RO. Nation LIVE's own revenue."
                  : "; RO. Nation LIVE retains a 10% platform fee on the amount received, and the balance is payable to the organiser."}{" "}
                All figures are in Robux (R$).
                {capped
                  ? " Figures cover the most recent 5,000 payments in this period."
                  : ""}
              </p>
              <p className="mt-2">
                Generated {formatDateTime(generatedOn)} · For reconciliation and payout.
              </p>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className={`mt-1 font-semibold text-slate-900 ${mono ? "tabular-nums" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function Line({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={muted ? "text-slate-500" : "text-slate-700"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

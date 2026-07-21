import type { ReactNode } from "react";
import type { Settlement } from "@/lib/settlement";
import { formatRobux } from "@/lib/tickets/pricing";
import { LocalTime } from "@/components/local-time";
import { PrintButton } from "./print-button";

// A settlement document, as a printable page. White paper, black ink, RNL's mark
// top-left - built to be saved as a PDF from the browser (the print button below).
//
// It renders OUTSIDE the portal chrome (reached from the company invoice pages and the
// partner/SHASHA routes), so it is the whole page: no nav, no footer, nothing to strip
// when it prints. It forces its own light palette with explicit colours rather than
// theme tokens, because the portal it is reached from is dark and a statement about
// money must look the same on every screen and on paper.
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
    <div className="min-h-dvh bg-white text-black">
      {/* Print rules: hide the toolbar, keep the paper white, give the page sensible
          margins, and don't slice a table row across a page break. */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          html, body { background: #ffffff !important; }
          .grain::before { display: none !important; }
          tr, section, header, footer { break-inside: avoid; }
        }
        @page { margin: 16mm; }
      `}</style>

      <div className="mx-auto max-w-3xl px-8 py-10 print:px-0 print:py-0">
        {/* Toolbar - screen only */}
        <div className="no-print mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <a href={backHref} className="text-sm text-neutral-500 hover:text-black">
              ← {backLabel}
            </a>
            {statusBadge}
          </div>
          <div className="flex items-center gap-3">
            {actions}
            <PrintButton />
          </div>
        </div>

        {/* Letterhead */}
        <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-6">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/brandassets/square/RNL_square_logo_no_fan.jpg"
              alt="RO. Nation LIVE"
              width={64}
              height={64}
              className="h-16 w-16 shrink-0 rounded object-contain"
            />
            <div>
              <p className="text-lg font-extrabold uppercase tracking-tight">
                RO. Nation LIVE
              </p>
              <p className="text-xs text-neutral-500">ronation.live</p>
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-extrabold uppercase tracking-wide">
              {isSelf ? "Revenue statement" : "Payout statement"}
            </h1>
            <p className="mt-1 text-xs text-neutral-500">No. {invoiceNo}</p>
            <p className="text-xs text-neutral-500">Issued <LocalTime value={generatedOn} mode="date" /></p>
          </div>
        </header>

        {/* Parties + period */}
        <section className="mt-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
              {isSelf ? "For" : "Payable to"}
            </p>
            <p className="mt-1 text-base font-semibold">{payeeName}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
              Period
            </p>
            <p className="mt-1 text-base font-semibold">{periodLabel}</p>
          </div>
        </section>

        {/* Line items - one row per show */}
        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-[11px] uppercase tracking-wide text-neutral-500">
              <th className="py-2 font-semibold">Show</th>
              <th className="py-2 font-semibold">Date</th>
              <th className="py-2 text-right font-semibold">Paid tickets</th>
              <th className="py-2 text-right font-semibold">Gross</th>
            </tr>
          </thead>
          <tbody>
            {shows.length ? (
              shows.map((s) => (
                <tr key={s.eventId} className="border-b border-neutral-200">
                  <td className="py-2.5 pr-4 font-medium">{s.title}</td>
                  <td className="py-2.5 pr-4 text-neutral-600"><LocalTime value={s.startsAt} mode="date" /></td>
                  <td className="py-2.5 text-right tabular-nums">{s.payments}</td>
                  <td className="py-2.5 text-right tabular-nums">{formatRobux(s.robux)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-8 text-center text-neutral-500">
                  No paid tickets in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totals - the fee stack. The partner variant carries RNL's platform fee and
            ends in the amount payable; the self variant stops at what RNL keeps. */}
        <section className="mt-6 flex justify-end">
          <dl className="w-full max-w-xs space-y-1.5 text-sm">
            <Line label="Gross (buyers paid)" value={formatRobux(payout.gross)} />
            <Line label="Roblox fee (30%)" value={`− ${formatRobux(payout.robloxFee)}`} muted />
            {isSelf ? (
              <div className="mt-1 border-t-2 border-black pt-2">
                <Line label="Net revenue" value={formatRobux(payout.afterRoblox)} strong />
              </div>
            ) : (
              <>
                <Line label="Received by RNL" value={formatRobux(payout.afterRoblox)} />
                <Line
                  label="RNL platform fee (10%)"
                  value={`− ${formatRobux(payout.rnlFee)}`}
                  muted
                />
                <div className="mt-1 border-t-2 border-black pt-2">
                  <Line label="Amount payable" value={formatRobux(payout.partnerPayout)} strong />
                </div>
              </>
            )}
          </dl>
        </section>

        {/* Small print */}
        <footer className="mt-12 border-t border-neutral-300 pt-4 text-[11px] leading-relaxed text-neutral-500">
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
            Generated <LocalTime value={generatedOn} mode="datetime" /> · For reconciliation and payout.
          </p>
        </footer>
      </div>
    </div>
  );
}

function Line({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? "font-bold" : muted ? "text-neutral-500" : "text-neutral-700"}>
        {label}
      </dt>
      <dd className={`tabular-nums ${strong ? "text-lg font-extrabold" : ""}`}>{value}</dd>
    </div>
  );
}

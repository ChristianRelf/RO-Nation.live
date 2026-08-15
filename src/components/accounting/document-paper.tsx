import type { ReactNode } from "react";
import type { AccountingDocument } from "@prisma/client";
import { DocumentStatus } from "@prisma/client";
import { kindConfig } from "@/lib/accounting/kinds";
import { documentTerms } from "@/lib/accounting/terms";
import { TermsBlock } from "@/components/accounting/terms-block";
import { formatQty, readLineItems } from "@/lib/accounting/lines";
import { formatRobux } from "@/lib/tickets/pricing";
import { LocalTime } from "@/components/local-time";
import { PrintButton } from "@/components/portal/print-button";

// A hand-authored accounting document, as a printable page.
//
// The sibling of PayoutInvoice, and deliberately the same paper: white field, black ink,
// RNL's mark top-left, its own light palette forced with explicit colours rather than
// theme tokens. A contractor should not be able to tell that one of these was generated
// from the ticket ledger and the other typed by hand - they are both documents from the
// same company, and they should look it.
//
// It renders as the WHOLE page (no company shell, no portal chrome), so there is nothing
// to strip when it prints. It is also the exact component the public share link serves:
// one renderer for the company's view and the recipient's means the thing you checked
// before sending is the thing they receive.

export function DocumentPaper({
  document: doc,
  backHref,
  backLabel = "Back to accounting",
  statusBadge,
  actions,
  panel,
  relatedNumber,
}: {
  document: AccountingDocument;
  /** Omit for the public share view, which has nowhere of ours to go back to. */
  backHref?: string;
  backLabel?: string;
  /** Screen-only chip beside the back link. Never prints. */
  statusBadge?: ReactNode;
  /** Screen-only toolbar actions beside Print. Never prints. */
  actions?: ReactNode;
  /**
   * A screen-only block between the toolbar and the paper - the share link, a void
   * form. Never prints, so anything the COMPANY needs to see but the recipient must
   * not receive goes here rather than on the sheet.
   */
  panel?: ReactNode;
  /** The human number of the document this one settles or corrects, if any. */
  relatedNumber?: string | null;
}) {
  const cfg = kindConfig(doc.kind);
  const lines = readLineItems(doc.lineItems);
  const isVoid = doc.status === DocumentStatus.VOID;
  const isDraft = doc.status === DocumentStatus.DRAFT;

  return (
    <div className="min-h-dvh bg-white text-black">
      {/* Same print rules as PayoutInvoice: lose the toolbar, keep the paper white,
          sensible margins, and never slice a table row across a page break. */}
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
        {backHref || statusBadge || actions ? (
          <div className="no-print mb-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {backHref ? (
                <a href={backHref} className="text-sm text-neutral-500 hover:text-black">
                  ← {backLabel}
                </a>
              ) : null}
              {statusBadge}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {actions}
              <PrintButton />
            </div>
          </div>
        ) : null}

        {panel ? <div className="no-print mb-8">{panel}</div> : null}

        {/* A void or unissued document must say so ON PAPER, not just in the chrome.
            A cancelled statement that prints looking exactly like a live one is the
            single most dangerous thing this component could do. */}
        {isVoid ? (
          <p className="mb-6 border-2 border-red-700 px-4 py-3 text-center text-sm font-extrabold uppercase tracking-widest text-red-700">
            Void - cancelled{doc.voidReason ? `: ${doc.voidReason}` : ""}
          </p>
        ) : null}
        {isDraft ? (
          <p className="mb-6 border-2 border-dashed border-neutral-400 px-4 py-3 text-center text-sm font-extrabold uppercase tracking-widest text-neutral-500">
            Draft - not issued
          </p>
        ) : null}

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
              {cfg.heading}
            </h1>
            <p className="mt-1 text-xs text-neutral-500">
              {doc.number ? `No. ${doc.number}` : "Unnumbered draft"}
            </p>
            <p className="text-xs text-neutral-500">
              Dated <LocalTime value={doc.documentDate} mode="date" />
            </p>
          </div>
        </header>

        {/* Parties, dates, and what it is for */}
        <section className="mt-6 grid gap-6 text-sm sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
              {cfg.partyLabel}
            </p>
            <p className="mt-1 text-base font-semibold">{doc.counterpartyName}</p>
            {doc.counterpartyRef ? (
              <p className="text-xs text-neutral-600">{doc.counterpartyRef}</p>
            ) : null}
            {doc.counterpartyDetail ? (
              <p className="mt-1 whitespace-pre-line text-xs text-neutral-600">
                {doc.counterpartyDetail}
              </p>
            ) : null}
          </div>
          <div className="sm:text-right">
            <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
              For
            </p>
            <p className="mt-1 text-base font-semibold">{doc.title}</p>
            {doc.dueDate ? (
              <p className="mt-1 text-xs text-neutral-600">
                Due <LocalTime value={doc.dueDate} mode="date" />
              </p>
            ) : null}
            {relatedNumber ? (
              <p className="mt-1 text-xs text-neutral-600">
                {cfg.relates ? cfg.relates.label : "Against"} {relatedNumber}
              </p>
            ) : null}
          </div>
        </section>

        {/* Line items */}
        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-[11px] uppercase tracking-wide text-neutral-500">
              <th className="py-2 font-semibold">Description</th>
              <th className="py-2 text-right font-semibold">Qty</th>
              <th className="py-2 text-right font-semibold">Unit</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.length ? (
              lines.map((l, i) => (
                // Index as key: these rows have no id of their own and, once issued, no
                // ability to reorder - the array is frozen JSON.
                <tr key={i} className="border-b border-neutral-200">
                  <td className="py-2.5 pr-4 font-medium">{l.description}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-neutral-600">
                    {formatQty(l.qtyCenti)}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-neutral-600">
                    {formatRobux(l.unitRobux)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {formatRobux(l.amountRobux)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-8 text-center text-neutral-500">
                  No lines on this document.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totals. The subtotal row is suppressed when there is no adjustment - a
            subtotal identical to the total two lines below it is noise on paper. */}
        <section className="mt-6 flex justify-end">
          <dl className="w-full max-w-xs space-y-1.5 text-sm">
            {doc.adjustmentRobux !== 0 ? (
              <>
                <Line label="Subtotal" value={formatRobux(doc.subtotal)} />
                <Line
                  label={doc.adjustmentLabel || "Adjustment"}
                  value={
                    doc.adjustmentRobux < 0
                      ? `− ${formatRobux(Math.abs(doc.adjustmentRobux))}`
                      : `+ ${formatRobux(doc.adjustmentRobux)}`
                  }
                  muted
                />
              </>
            ) : null}
            <div className="mt-1 border-t-2 border-black pt-2">
              <Line label={cfg.totalLabel} value={formatRobux(doc.total)} strong />
            </div>
          </dl>
        </section>

        {/* Terms and notes */}
        {doc.terms || doc.notes ? (
          <section className="mt-10 grid gap-6 text-sm sm:grid-cols-2">
            {doc.terms ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                  Terms
                </p>
                <p className="mt-1 whitespace-pre-line text-neutral-700">{doc.terms}</p>
              </div>
            ) : null}
            {doc.notes ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                  Notes
                </p>
                <p className="mt-1 whitespace-pre-line text-neutral-700">{doc.notes}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* The terms. Kind-specific, because the five kinds do not make the same promise -
            see lib/accounting/terms.ts. It prints on drafts too: a draft is a proof of the
            sheet somebody will receive, and one that omits the terms is not a proof of it. */}
        <TermsBlock terms={documentTerms(doc.kind)} />

        {/* Small print */}
        <footer className="mt-8 border-t border-neutral-300 pt-4 text-[11px] leading-relaxed text-neutral-500">
          <div className="space-y-1.5">
            {cfg.smallPrint.map((p, i) => (
              // Index as key: a frozen constant list, never reordered at runtime.
              <p key={i}>{p}</p>
            ))}
          </div>
          <p className="mt-2">
            {doc.issuedAt ? (
              <>
                Issued <LocalTime value={doc.issuedAt} mode="datetime" />
                {doc.issuedByName ? ` by ${doc.issuedByName}` : ""}.
              </>
            ) : (
              <>Prepared by {doc.createdByName}. Not yet issued.</>
            )}{" "}
            RO. Nation LIVE · ronation.live
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
      <dt
        className={strong ? "font-bold" : muted ? "text-neutral-500" : "text-neutral-700"}
      >
        {label}
      </dt>
      <dd className={`tabular-nums ${strong ? "text-lg font-extrabold" : ""}`}>{value}</dd>
    </div>
  );
}

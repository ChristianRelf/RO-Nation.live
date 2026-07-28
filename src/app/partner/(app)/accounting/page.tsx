import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AccountingDocument } from "@prisma/client";
import { requirePartnerAccount, isFullPartner } from "@/lib/partner-account";
import { listDocumentsForPartnerAccount, partnerLedger } from "@/lib/accounting/documents";
import { kindConfig } from "@/lib/accounting/kinds";
import {
  PARTNER_SEEN_COOKIE,
  parsePartnerSeen,
  partnerVisibleAt,
} from "@/lib/partner-seen";
import { formatRobux } from "@/lib/tickets/pricing";
import { formatDate } from "@/lib/format";
import { env } from "@/lib/env";
import { Kicker } from "@/components/ui";
import { DocumentStatusBadge } from "@/components/accounting/document-status-badge";
import { SeenMarker } from "@/components/seen-marker";
import { PartnerLedgerStrip } from "@/components/partner/ledger-strip";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Accounting" };

// The partner's ledger.
//
// Three things this page used to get wrong, all of them the kind a partner notices and
// nobody inside the company does, because nobody inside the company reads it:
//
//   1. Status was plain text from a private label map, while the same status renders as a
//      coloured chip everywhere staff look. DocumentStatusBadge is now shared by both, so
//      "issued" cannot come to mean two different things on two pages - and it carries the
//      one-line explanation of each state as its title.
//   2. It was a six-column table in an overflow-x-auto, which on a phone is a table you
//      drag sideways to read one row of. The columns that are not the answer to "what is
//      this and how much" now fold away below `sm` and the row carries them inline.
//   3. It opened on a wall of rows with no figure anywhere. The strip at the top is the
//      same partnerLedger() the overview reads, so the two pages cannot disagree.
//
// This page is also where the "new since you were last here" marker ADVANCES - never the
// overview. See lib/partner-seen.ts for why that split is the whole point of it.

export default async function PartnerAccountingPage() {
  const user = await requirePartnerAccount();
  // The lock, not just the hidden nav item: a potential partner who deep-links here is sent
  // back to the overview with a note. isFullPartner mirrors the Accounting tab's own gate.
  if (!isFullPartner(user.account)) redirect("/partner?notice=accounting");

  const docs = await listDocumentsForPartnerAccount(user.account.id);
  const ledger = partnerLedger(docs);
  const lastSeen = parsePartnerSeen(cookies().get(PARTNER_SEEN_COOKIE)?.value);

  return (
    <div className="mx-auto max-w-4xl">
      <Kicker>Accounting</Kicker>
      <h1 className="display mt-4 text-4xl leading-none sm:text-5xl">Your documents</h1>
      <p className="mt-4 max-w-xl text-muted">
        Every document RO. Nation LIVE has raised with {user.account.name} - payouts,
        billables, receipts and credit notes. Open one to read or print it.
      </p>

      {docs.length ? <PartnerLedgerStrip ledger={ledger} /> : null}

      {docs.length === 0 ? (
        <div className="card mt-10 p-8 text-center">
          <p className="text-muted">Nothing here yet.</p>
          <p className="mt-2 text-sm text-faint">
            When we raise a payout, invoice, receipt or credit note with you, it appears here.
          </p>
        </div>
      ) : (
        <div className="mt-10">
          {/* The scroller stays, even though the columns now fold - it is the belt to the
              braces. Folding handles the ordinary case; a document titled with something
              long and unbreakable is what would otherwise widen the PAGE rather than the
              table, and a horizontally scrolling page is worse than a scrolling table. */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Documents raised with {user.account.name}, newest first.
              </caption>
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-kicker text-faint">
                  <th scope="col" className="py-3 pr-4 font-semibold">
                    Document
                  </th>
                  <th scope="col" className="hidden py-3 pr-4 font-semibold sm:table-cell">
                    For
                  </th>
                  <th scope="col" className="hidden py-3 pr-4 font-semibold md:table-cell">
                    Date
                  </th>
                  <th scope="col" className="py-3 pr-4 text-right font-semibold">
                    Amount
                  </th>
                  <th scope="col" className="hidden py-3 pr-4 font-semibold sm:table-cell">
                    Status
                  </th>
                  <th scope="col" className="py-3">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <Row key={d.id} doc={d} lastSeen={lastSeen} />
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-xs text-faint">
            Every document opens on its own link, which you can print or save as a PDF from
            your browser. Something here look wrong?{" "}
            <a
              href={`${env.siteUrl}/contact?kind=partnership&subject=${encodeURIComponent(
                `Query about my accounting (${user.account.name})`,
              )}`}
              className="link-underline font-semibold text-muted transition-colors hover:text-accent"
            >
              Query it with us
            </a>
            .
          </p>
        </div>
      )}

      {/* Advances the marker once this list has actually been rendered. The chips above were
          decided against the OLD cookie value, so this visit still shows them. */}
      <SeenMarker endpoint="/api/portal/seen/partner" />
    </div>
  );
}

function Row({ doc, lastSeen }: { doc: AccountingDocument; lastSeen: Date | null }) {
  const isNew = lastSeen ? partnerVisibleAt(doc) > lastSeen : false;

  return (
    <tr className="border-b border-line/60 align-top">
      <td className="py-3.5 pr-4">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium text-fg">{kindConfig(doc.kind).heading}</span>
          {isNew ? (
            <span className="rounded-brand border border-accent/40 bg-accent-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-kicker text-accent">
              New
            </span>
          ) : null}
        </span>
        <span className="block font-mono text-[11px] text-faint">{doc.number ?? "—"}</span>

        {/* The folded columns, carried inline on a phone rather than dropped. A status
            somebody has to rotate their handset to read is a status they do not read. */}
        <span className="mt-1.5 block sm:hidden">
          <span className="block truncate text-xs text-muted">{doc.title}</span>
          <span className="mt-1.5 flex items-center gap-2">
            <DocumentStatusBadge status={doc.status} />
            <span className="text-[11px] text-faint">{formatDate(doc.documentDate)}</span>
          </span>
        </span>
      </td>

      <td className="hidden py-3.5 pr-4 text-muted sm:table-cell">{doc.title}</td>
      <td className="hidden py-3.5 pr-4 text-muted md:table-cell">
        {formatDate(doc.documentDate)}
      </td>
      <td className="tnum py-3.5 pr-4 text-right">{formatRobux(doc.total)}</td>
      <td className="hidden py-3.5 pr-4 sm:table-cell">
        <DocumentStatusBadge status={doc.status} />
      </td>
      <td className="py-3.5 text-right">
        {doc.shareToken ? (
          <a
            href={`${env.siteUrl}/doc/${doc.shareToken}`}
            target="_blank"
            rel="noreferrer"
            className="link-underline whitespace-nowrap text-accent transition-colors hover:text-fg"
          >
            View
            <span aria-hidden className="ml-1 text-faint">
              ↗
            </span>
            <span className="sr-only">
              {kindConfig(doc.kind).heading} {doc.number ?? ""} (opens in a new tab)
            </span>
          </a>
        ) : null}
      </td>
    </tr>
  );
}

import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { AccountingDocument, PaymentRequest } from "@prisma/client";
import { DocumentStatus } from "@prisma/client";
import { requirePayUser } from "@/lib/pay";
import {
  PARTNER_SEEN_COOKIE,
  parsePartnerSeen,
  partnerVisibleAt,
} from "@/lib/partner-seen";
import { SeenMarker } from "@/components/seen-marker";
import { ConfirmButton } from "@/components/confirm-button";
import {
  listDocumentsForPartnerAccount,
  partnerLedger,
} from "@/lib/accounting/documents";
import { kindConfig } from "@/lib/accounting/kinds";
import { openReleasesByDocument } from "@/lib/accounting/requests";
import { requestFundsAction } from "@/app/actions/payments";
import { documentUrl, outboundUrls } from "@/lib/accounting/urls";
import { formatRobux } from "@/lib/tickets/pricing";
import { formatDate } from "@/lib/format";
import { Kicker } from "@/components/ui";
import { DocumentStatusBadge } from "@/components/accounting/document-status-badge";
import { PartnerLedgerStrip } from "@/components/partner/ledger-strip";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Statements" };

/**
 * The client's full statement - every document RNL has issued against their entity.
 *
 * This is the page that used to be portal.ronation.live/partner/accounting, moved to the
 * host where the rest of the client-facing payment system now lives. The /partner tab now
 * links here rather than holding a second copy: one list, one address, and no chance of a
 * partner being shown two subtly different tables of their own money.
 *
 * Drafts are excluded in the query, not filtered here - a document the company has not
 * issued is not the client's to see. See listDocumentsForPartnerAccount.
 *
 * This page is also where the "new since you were last here" marker ADVANCES - never the
 * overview. See lib/partner-seen.ts for why that split is the whole point of it: landing
 * on a page that says "2 new" must not be what consumes the 2. The marker moved to this
 * host along with the list, because the cookie is host-only and one set on the portal is
 * simply absent here.
 */
const ERRORS: Record<string, string> = {
  nodoc: "That document isn't on your statement.",
  notreleasable:
    "There are no funds to release on that one — it isn't money owed to you.",
  alreadypaid: "That has already been paid out.",
  notopen: "That document isn't open, so there's nothing to release.",
  alreadyrequested:
    "You've already asked for the funds on that one. It's with us — see Your requests.",
};

const OK: Record<string, string> = {
  requested:
    "Requested. Somebody will action it, and the document is marked paid once the Robux is sent.",
};

export default async function StatementsPage({
  searchParams,
}: {
  searchParams: { ok?: string; error?: string };
}) {
  const user = await requirePayUser();

  const docs = await listDocumentsForPartnerAccount(user.account.id);
  const ledger = partnerLedger(docs);
  const lastSeen = parsePartnerSeen(cookies().get(PARTNER_SEEN_COOKIE)?.value);

  // One query for the whole table rather than one per row. Keyed by document id, so a row
  // can tell "you can ask for this" from "you already have" without a second thought.
  const openReleases = await openReleasesByDocument(
    user.account.id,
    docs.map((d) => d.id),
  );

  // What is sitting there, issued and unclaimed. Called out above the table because it is
  // the one thing on this page somebody can act on, and a button buried on row nine of a
  // table nobody scrolls is a button that does not exist.
  const claimable = docs.filter(
    (d) =>
      kindConfig(d.kind).releasable &&
      d.status === DocumentStatus.ISSUED &&
      !openReleases.has(d.id),
  );
  const heldTotal = claimable.reduce((n, d) => n + d.total, 0);

  return (
    <div className="mx-auto max-w-4xl">
      <Kicker>Statements</Kicker>
      <h1 className="display mt-4 text-4xl leading-none sm:text-5xl">Your documents</h1>
      <p className="mt-4 max-w-xl text-muted">
        Every document RO. Nation LIVE has raised with {user.account.name} — payouts,
        billables, receipts and credit notes. Open one to read or print it.
      </p>

      {searchParams.error ? (
        <p className="mt-8 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {ERRORS[searchParams.error] ?? "That didn't work."}
        </p>
      ) : null}
      {searchParams.ok ? (
        <p className="mt-8 border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
          {OK[searchParams.ok] ?? "Done."}
        </p>
      ) : null}

      {docs.length ? <PartnerLedgerStrip ledger={ledger} /> : null}

      {/* Issuing a payroll slip or credit note does not send the Robux - it holds it until
          you ask. That is a genuine change in what these documents mean, so it is stated
          once, plainly, above the table, rather than left to be inferred from a button. */}
      {claimable.length ? (
        <div className="card mt-8 border-accent/25 bg-accent-soft/40 p-5">
          <p className="text-sm font-semibold text-fg">
            {formatRobux(heldTotal)} held and ready to request
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Across {claimable.length} document{claimable.length === 1 ? "" : "s"}. Issuing
            one doesn&apos;t send the Robux — the amount is held until you ask for it. Use
            the <span className="font-semibold text-fg">Request funds</span> button on the
            row, and we&apos;ll pay it out and mark the document paid.
          </p>
        </div>
      ) : null}

      {docs.length === 0 ? (
        <div className="card mt-10 p-8 text-center">
          <p className="text-muted">Nothing here yet.</p>
          <p className="mt-2 text-sm text-faint">
            When we raise a payout, invoice, receipt or credit note with you, it appears
            here.
          </p>
        </div>
      ) : (
        <div className="mt-10">
          {/* The scroller stays, even though the columns fold - it is the belt to the
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
                  <Row
                    key={d.id}
                    doc={d}
                    lastSeen={lastSeen}
                    openRelease={openReleases.get(d.id) ?? null}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-xs text-faint">
            Every document opens on its own link, which you can print or save as a PDF from
            your browser. Something here look wrong?{" "}
            <a
              href={`${outboundUrls.contact()}?kind=partnership&subject=${encodeURIComponent(
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

      {/* Advances the marker once this list has actually been rendered. The chips above
          were decided against the OLD cookie value, so this visit still shows them. */}
      <SeenMarker endpoint="/api/pay/seen" />
    </div>
  );
}

function Row({
  doc,
  lastSeen,
  openRelease,
}: {
  doc: AccountingDocument;
  lastSeen: Date | null;
  /** An unanswered claim on this document's funds, if there is one. */
  openRelease: PaymentRequest | null;
}) {
  const href = documentUrl(doc);
  const isNew = lastSeen ? partnerVisibleAt(doc) > lastSeen : false;

  // The three states a releasable document can be in, from the payee's side. Everything
  // else - an invoice, a receipt, a paid slip - gets no control at all, because there is
  // nothing to ask for.
  const releasable = kindConfig(doc.kind).releasable;
  const canRequest =
    releasable && doc.status === DocumentStatus.ISSUED && !openRelease;

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
        <span className="block font-mono text-[11px] text-faint">
          {doc.number ?? "—"}
        </span>

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
        <span className="flex flex-col items-end gap-1.5">
          {/* A plain <a>, and absolute: documents live on accounts.ronation.live, which is
              not this host. documentUrl() is the one place that address is decided. */}
          {href ? (
            <a
              href={href}
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

          {canRequest ? (
            <form action={requestFundsAction}>
              {/* The ONLY field. Everything else about this claim - whose it is, how much,
                  whether it can be claimed - is re-derived from the document server-side.
                  See requestFundsAction. */}
              <input type="hidden" name="id" value={doc.id} />
              <ConfirmButton
                message={`Request the ${formatRobux(doc.total)} held on this document? It goes to RO. Nation LIVE to action — the Robux is sent by group payout, and the document is marked paid once it has been.`}
                className="whitespace-nowrap rounded-lg border border-accent/40 bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent transition-colors hover:border-accent"
              >
                Request funds
              </ConfirmButton>
            </form>
          ) : null}

          {openRelease ? (
            <span className="whitespace-nowrap text-[11px] text-amber-300">
              Requested {formatDate(openRelease.createdAt)}
            </span>
          ) : null}

          {/* Said only on the documents where it is TRUE. A paid invoice has not been
              "paid out to you", and putting this line on every settled row would be a
              small lie repeated down the whole table. */}
          {releasable && doc.status === DocumentStatus.PAID ? (
            <span className="whitespace-nowrap text-[11px] text-faint">Paid out</span>
          ) : null}
        </span>
      </td>
    </tr>
  );
}

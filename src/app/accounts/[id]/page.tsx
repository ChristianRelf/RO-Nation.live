import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentKind, DocumentStatus } from "@prisma/client";
import { requireCompanyUser } from "@/lib/company";
import { documentUrl } from "@/lib/accounting/urls";
import { DocumentPaper } from "@/components/accounting/document-paper";
import { DocumentStatusBadge } from "@/components/accounting/document-status-badge";
import { ShareLink } from "@/components/accounting/share-link";
import { ConfirmButton } from "@/components/confirm-button";
import { LocalTime } from "@/components/local-time";
import { getDocument } from "@/lib/accounting/documents";
import { openReleaseFor } from "@/lib/accounting/requests";
import { kindConfig, isHandAuthored } from "@/lib/accounting/kinds";
import {
  creditNoteFromAction,
  discardDraftAction,
  issueDocumentAction,
  markPaidAction,
  rotateShareLinkAction,
  voidDocumentAction,
} from "@/app/actions/accounting";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Document",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  frozen: "That document has been issued, so it can't be edited.",
  already: "That document had already been issued.",
  missing: "That document no longer exists.",
  notopen: "That document isn't open, so it can't be changed.",
  notdraft: "That isn't a draft.",
  notissued: "That document hasn't been issued, so it has no share link.",
  noteditable:
    "A ticket refund can't be edited — its amount is capped by the ticket it was written from. Discard it and write a new one.",
  // The refund issued; only the ticket cancellation failed. Said loudly, because the
  // holder now has money coming AND a ticket that still scans at the door.
  voidfailed:
    "The refund was issued, but the ticket could NOT be cancelled — cancel it by hand from Tickets.",
};

const OK: Record<string, string> = {
  issued: "Issued. It's numbered, frozen, and the share link below is live.",
  issuedvoided:
    "Issued, and the ticket is cancelled — its seat is back in the room. Now pay the Robux out.",
  paid: "Marked as paid.",
  voided: "Voided. It stays on the record, marked cancelled.",
  rotated: "New share link minted. The old one is dead.",
  released:
    "Released. The payee's request is answered and this document is marked paid — make sure the Robux has actually gone out.",
};

// The company's view of one document: the printable sheet, plus everything only the
// company gets - the status, the share link, and whichever lifecycle actions the current
// status actually permits. All of it in the no-print toolbar and panel, so none of it
// reaches paper.
export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ok?: string; error?: string };
}) {
  await requireCompanyUser();

  const doc = await getDocument(params.id);
  if (!doc) notFound();

  // The related document is read only for its NUMBER, to print "credits RNL-INV-2026-3".
  // A missing one (deleted draft) simply prints nothing rather than 404ing this page.
  const related = doc.relatedId ? await getDocument(doc.relatedId) : null;

  const cfg = kindConfig(doc.kind);
  const isDraft = doc.status === DocumentStatus.DRAFT;
  const isIssued = doc.status === DocumentStatus.ISSUED;
  const isPaid = doc.status === DocumentStatus.PAID;
  // A credit note credits an invoice or a payment - crediting a credit note is a knot,
  // and a receipt records something that already happened.
  const creditable =
    isIssued &&
    (doc.kind === DocumentKind.INVOICE ||
      doc.kind === DocumentKind.CONTRACTOR_PAYMENT);

  // Built from the ACCOUNTS origin, not from currentOrigin(). They are the same host
  // today - this page is only served there - but the link is the string that gets pasted
  // into a message to a contractor, and it must be the document's one canonical address
  // whatever host happened to render it. documentUrl() is where that decision lives, and
  // the partner's own statement on pay.ronation.live builds the identical string from it.
  const shareUrl = documentUrl(doc);

  // Has the payee asked for these funds? Read here so "Mark paid" is never pressed blind:
  // issuing an outbound document HOLDS the money (see KindConfig.releasable), and the
  // person who wrote it needs to see that somebody is waiting on it. Marking it paid also
  // answers the claim - closeReleasesFor, in markPaidAction - so this is the notice that
  // makes that side effect legible before it happens rather than after.
  const claim = cfg.releasable ? await openReleaseFor(doc.id) : null;

  return (
    <DocumentPaper
      document={doc}
      backHref="/"
      backLabel="Back to accounting"
      relatedNumber={related?.number ?? null}
      statusBadge={<DocumentStatusBadge status={doc.status} tone="light" />}
      actions={
        <>
          {isDraft && isHandAuthored(doc.kind) ? (
            <a
              href={`/${doc.id}/edit`}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:border-neutral-900 hover:text-black"
            >
              Edit
            </a>
          ) : null}

          {isDraft ? (
            <form action={issueDocumentAction}>
              <input type="hidden" name="id" value={doc.id} />
              <ConfirmButton
                message={
                  // A refund's confirm names the consequence that is NOT on the paper:
                  // issuing it cancels somebody's ticket. That belongs in the sentence
                  // you read before clicking, not only in the document you read after.
                  doc.kind === DocumentKind.TICKET_REFUND && doc.voidsTicket
                    ? "Issue this refund? It will be numbered, every figure frozen, AND the ticket will be cancelled — its holder loses their place. You still have to pay the Robux out by hand."
                    : `Issue this ${cfg.label.toLowerCase()}? It will be numbered and every figure frozen — after this it can only be voided or credited.`
                }
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-80"
              >
                Issue
              </ConfirmButton>
            </form>
          ) : null}

          {isIssued ? (
            <form action={markPaidAction}>
              <input type="hidden" name="id" value={doc.id} />
              <button
                type="submit"
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-80"
              >
                Mark paid
              </button>
            </form>
          ) : null}

          {creditable ? (
            <form action={creditNoteFromAction}>
              <input type="hidden" name="id" value={doc.id} />
              <button
                type="submit"
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:border-neutral-900 hover:text-black"
              >
                Credit note
              </button>
            </form>
          ) : null}
        </>
      }
      panel={
        <div className="space-y-4">
          {searchParams.error ? (
            <p className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
              {ERRORS[searchParams.error] ?? "That didn't work."}
            </p>
          ) : null}
          {searchParams.ok ? (
            <p className="border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {OK[searchParams.ok] ?? "Done."}
            </p>
          ) : null}

          {/* ---- Somebody is waiting on this ----------------------------- */}
          {claim ? (
            <div className="rounded-lg border border-amber-400 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                {claim.submittedByName} has requested these funds
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-800">
                Asked <LocalTime value={claim.createdAt} mode="datetime" />. Marking this
                paid answers their request — so only do it once the Robux has actually gone
                out by group payout. You can also answer it from the requests queue.
              </p>
              <a
                href="/requests"
                className="mt-2 inline-block text-xs font-semibold text-amber-900 underline"
              >
                Open the requests queue
              </a>
            </div>
          ) : null}

          {/* ---- The share link ------------------------------------------ */}
          {shareUrl ? (
            <div className="rounded-lg border border-neutral-300 bg-neutral-50 p-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                  Share link
                </p>
                <p className="text-xs text-neutral-500">
                  {doc.firstViewedAt ? (
                    <>
                      Opened <LocalTime value={doc.firstViewedAt} mode="datetime" /> ·{" "}
                      {doc.viewCount} view{doc.viewCount === 1 ? "" : "s"}
                    </>
                  ) : (
                    "Not opened yet"
                  )}
                </p>
              </div>
              <ShareLink url={shareUrl} />
              <p className="mt-2 text-xs text-neutral-500">
                Anyone with this link can read the document — send it to{" "}
                {doc.counterpartyName}, and nobody else. Rotating replaces it and kills
                the old one.
              </p>
              <form action={rotateShareLinkAction} className="mt-2">
                <input type="hidden" name="id" value={doc.id} />
                <ConfirmButton
                  message="Mint a new share link? Anyone holding the current link will lose access."
                  className="text-xs font-semibold text-neutral-600 underline hover:text-black"
                >
                  Rotate link
                </ConfirmButton>
              </form>
            </div>
          ) : null}

          {/* ---- Destructive, kept away from the toolbar ------------------ */}
          {isDraft ? (
            <form action={discardDraftAction}>
              <input type="hidden" name="id" value={doc.id} />
              <ConfirmButton
                message="Discard this draft? It hasn't been issued, so it will simply be gone."
                className="text-xs font-semibold text-red-700 underline hover:text-red-900"
              >
                Discard draft
              </ConfirmButton>
            </form>
          ) : null}

          {isIssued || isPaid ? (
            <form
              action={voidDocumentAction}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 p-3"
            >
              <input type="hidden" name="id" value={doc.id} />
              <label className="sr-only" htmlFor="void-reason">
                Reason for voiding
              </label>
              <input
                id="void-reason"
                name="reason"
                maxLength={500}
                placeholder="Why is this being voided?"
                className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-xs text-neutral-800"
              />
              <ConfirmButton
                message="Void this document? It stays on the record marked cancelled, and its number is never reused."
                className="shrink-0 rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"
              >
                Void
              </ConfirmButton>
            </form>
          ) : null}
        </div>
      }
    />
  );
}

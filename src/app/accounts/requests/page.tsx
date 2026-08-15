import type { Metadata } from "next";
import Link from "next/link";
import type { PaymentRequest } from "@prisma/client";
import { PaymentRequestKind, PaymentRequestStatus } from "@prisma/client";
import { requireCompanyUser } from "@/lib/company";
import { AccountingShell } from "@/components/accounting/accounting-shell";
import { AdminHeader } from "@/components/admin-ui";
import { RequestStatusBadge } from "@/components/accounting/request-status-badge";
import { ConfirmButton } from "@/components/confirm-button";
import { LocalTime } from "@/components/local-time";
import { formatRobux } from "@/lib/tickets/pricing";
import { listRequests, openRequestCount } from "@/lib/accounting/requests";
import {
  REQUEST_STATUS_META,
  requestKindConfig,
} from "@/lib/accounting/request-kinds";
import { outboundUrls } from "@/lib/accounting/urls";
import {
  acceptPaymentRequest,
  declinePaymentRequest,
} from "@/app/actions/payments";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Requests" };

const ERRORS: Record<string, string> = {
  already: "Somebody answered that one first. The queue below is up to date.",
  missing: "That request no longer exists.",
  noreason:
    "Declining needs a reason — the requester reads it, so it can't be left blank.",
  // The accept went through; the document did not move. Said loudly, because the request
  // now reads as accepted while the money it settles is still showing as owed.
  notsettled:
    "The request was accepted, but the document did NOT move to paid — it had already been paid or voided. Check it and settle it by hand.",
};

const OK: Record<string, string> = {
  declined: "Declined. The requester can see the reason on their own list.",
};

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: PaymentRequestStatus.OPEN, label: "Open" },
  { value: PaymentRequestStatus.ACCEPTED, label: "Accepted" },
  { value: PaymentRequestStatus.DECLINED, label: "Declined" },
  { value: PaymentRequestStatus.WITHDRAWN, label: "Withdrawn" },
];

/**
 * The requests queue - the staff side of the two forms on pay.ronation.live.
 *
 * This is the only place in the accounting system where something a person OUTSIDE the
 * company typed is on screen, and the page is shaped around that fact:
 *
 *   • Every figure is labelled as THEIRS. "They say they sent", "they are asking for" -
 *     never a bare amount in a column that looks like RNL's own arithmetic. Nothing here
 *     is a record of anything yet; it is a claim, and it reads like one.
 *   • Accepting does not settle anything. It raises a DRAFT and drops you into the editor
 *     to check it - see acceptPaymentRequest for why that gap is deliberate.
 *   • Declining takes a reason, because the requester reads it.
 */
export default async function RequestsPage({
  searchParams,
}: {
  searchParams: { status?: string; ok?: string; error?: string };
}) {
  const user = await requireCompanyUser();

  const status =
    searchParams.status && searchParams.status in REQUEST_STATUS_META
      ? (searchParams.status as PaymentRequestStatus)
      : undefined;

  const [requests, openRequests] = await Promise.all([
    listRequests(status),
    openRequestCount(),
  ]);

  return (
    <AccountingShell user={user} openRequests={openRequests}>
      <AdminHeader
        title="Payment requests"
        subtitle="What clients have asked for on pay.ronation.live — money coming in, money they want paid out, and claims on funds already held on an issued document."
      />

      {searchParams.error ? (
        <p className="mb-6 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {ERRORS[searchParams.error] ?? "That didn't work."}
        </p>
      ) : null}
      {searchParams.ok ? (
        <p className="mb-6 border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
          {OK[searchParams.ok] ?? "Done."}
        </p>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-1.5">
        {STATUS_TABS.map((t) => (
          <Link
            key={t.value || "all"}
            href={`/requests${t.value ? `?status=${t.value}` : ""}`}
            aria-current={(status ?? "") === t.value ? "page" : undefined}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              (status ?? "") === t.value
                ? "bg-accent-soft text-accent ring-1 ring-inset ring-accent/30"
                : "text-muted hover:bg-surface/60 hover:text-fg"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="card p-6 text-sm text-muted">
          {status
            ? "Nothing matches that filter."
            : "No requests yet. They arrive here when a client submits one on pay.ronation.live — which needs a partner account granted from Partner accounts."}
          {status ? null : (
            <>
              {" "}
              <a
                href={outboundUrls.partnerAccounts()}
                className="text-accent hover:underline"
              >
                Grant access ↗
              </a>
            </>
          )}
        </div>
      ) : (
        <ul className="space-y-4">
          {requests.map((r) => (
            <RequestCard key={r.id} request={r} />
          ))}
        </ul>
      )}
    </AccountingShell>
  );
}

function RequestCard({ request: r }: { request: PaymentRequest }) {
  const cfg = requestKindConfig(r.kind);
  const isOpen = r.status === PaymentRequestStatus.OPEN;
  const inbound = r.kind === PaymentRequestKind.PAYMENT;
  // A claim on funds already held by a document RNL issued. It behaves differently at
  // every step - the figure was frozen by RNL rather than typed by them, and accepting it
  // SETTLES that document instead of raising a new one - so it says so, here, where the
  // decision is made. See acceptPaymentRequest.
  const isRelease = r.kind === PaymentRequestKind.RELEASE;

  return (
    // The id is the anchor the "reason required" error scrolls back to - see
    // declinePaymentRequest, which redirects to /requests?error=noreason#<id>.
    <li id={r.id} className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-fg">{cfg.staffLabel}</span>
            <RequestStatusBadge status={r.status} />
          </p>
          <p className="mt-1 text-sm text-muted">
            {r.partnerAccountName}{" "}
            <span className="text-faint">
              · submitted by {r.submittedByName} ·{" "}
              <LocalTime value={r.createdAt} mode="datetime" />
            </span>
          </p>
        </div>

        {/* Signed by direction, so which way the Robux goes is legible without reading
            the label above it - the same amber-and-minus convention the register uses. */}
        <p
          className={`shrink-0 font-display text-3xl tabular-nums ${
            inbound ? "text-fg" : "text-amber-300"
          }`}
        >
          {inbound ? "" : "− "}
          {formatRobux(r.amountRobux)}
        </p>
      </div>

      {isRelease ? (
        <p className="mt-4 border-l-2 border-accent/40 pl-4 text-sm leading-relaxed text-muted">
          This is a claim on funds already held —{" "}
          <span className="text-fg">the figure is RNL&apos;s own, frozen at issue</span>,
          not something they typed. Accepting it marks that document{" "}
          <span className="text-fg">paid</span> and raises nothing new. Only accept once
          the Robux has actually been sent.
        </p>
      ) : null}

      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <Fact label="What for" value={r.reference} />
        {r.externalRef ? (
          <Fact label="Their reference" value={r.externalRef} mono />
        ) : null}
        {r.expectedAt ? (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-faint">
              {inbound ? "They say they sent it" : "Wanted by"}
            </dt>
            <dd className="mt-1 text-fg">
              <LocalTime value={r.expectedAt} mode="date" />
            </dd>
          </div>
        ) : null}
      </dl>

      {r.detail ? (
        <p className="mt-4 whitespace-pre-wrap border-l-2 border-line pl-4 text-sm leading-relaxed text-muted">
          {r.detail}
        </p>
      ) : null}

      {/* ---- What was decided, once it has been --------------------------- */}
      {!isOpen && r.reviewedByName ? (
        <p className="mt-4 border-t border-line pt-4 text-xs text-faint">
          {REQUEST_STATUS_META[r.status].label} by {r.reviewedByName}
          {r.reviewedAt ? (
            <>
              {" "}
              · <LocalTime value={r.reviewedAt} mode="datetime" />
            </>
          ) : null}
          {r.reviewNote ? (
            <span className="mt-1 block text-muted">“{r.reviewNote}”</span>
          ) : null}
        </p>
      ) : null}

      {/* The document it became. Rendered from documentId alone rather than a join - the
          draft may since have been discarded, and a dead link is a better answer than a
          page that 500s because a row it assumed would be there is not. */}
      {/* The document. On a RELEASE this is the one being claimed and is worth opening
          BEFORE deciding, so it is shown while the request is still open too. On the other
          kinds documentId only exists after acceptance, which is why the two are separate
          checks rather than one. */}
      {isRelease && r.againstDocumentId ? (
        <p className="mt-3 text-sm">
          <Link
            href={`/${r.againstDocumentId}`}
            className="text-accent hover:underline"
          >
            Open the document being claimed →
          </Link>
        </p>
      ) : r.documentId ? (
        <p className="mt-3 text-sm">
          <Link href={`/${r.documentId}`} className="text-accent hover:underline">
            Open the document this became →
          </Link>
        </p>
      ) : null}

      {/* ---- The decision ------------------------------------------------- */}
      {isOpen ? (
        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-start">
          <form action={acceptPaymentRequest} className="shrink-0">
            <input type="hidden" name="id" value={r.id} />
            <ConfirmButton
              message={
                isRelease
                  ? "Release these funds? This marks the document PAID — it does not send anything. Only do this once the Robux has actually gone out by group payout."
                  : inbound
                    ? "Accept this? A RECEIPT draft will be raised from it and opened for you to check. Nothing is numbered until you issue it — and only accept once the Robux has actually arrived."
                    : "Accept this? A PAYROLL SLIP draft will be raised from it and opened for you to check. Nothing is numbered until you issue it, and the Robux still has to be paid out by hand."
              }
              className="btn btn-accent"
            >
              {isRelease ? "Mark released" : "Accept"}
            </ConfirmButton>
          </form>

          <form
            action={declinePaymentRequest}
            className="flex flex-1 flex-wrap items-center gap-2"
          >
            <input type="hidden" name="id" value={r.id} />
            <label className="sr-only" htmlFor={`note-${r.id}`}>
              Why is this being declined?
            </label>
            <input
              id={`note-${r.id}`}
              name="note"
              maxLength={500}
              required
              placeholder="Why? They read this."
              className="min-w-0 flex-1 rounded-lg border border-line bg-elev px-3 py-2 text-sm text-fg"
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg border border-red-500/40 px-3 py-2 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/10"
            >
              Decline
            </button>
          </form>
        </div>
      ) : null}
    </li>
  );
}

function Fact({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-faint">
        {label}
      </dt>
      <dd className={`mt-1 break-words text-fg ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

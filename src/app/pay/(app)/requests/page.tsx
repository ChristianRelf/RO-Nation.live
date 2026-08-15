import type { Metadata } from "next";
import Link from "next/link";
import type { PaymentRequest } from "@prisma/client";
import { PaymentRequestKind, PaymentRequestStatus } from "@prisma/client";
import { requirePayUser } from "@/lib/pay";
import { listRequestsFor } from "@/lib/accounting/requests";
import { requestKindConfig } from "@/lib/accounting/request-kinds";
import { withdrawPaymentRequest } from "@/app/actions/payments";
import { RequestStatusBadge } from "@/components/accounting/request-status-badge";
import { ConfirmButton } from "@/components/confirm-button";
import { formatRobux } from "@/lib/tickets/pricing";
import { formatDate } from "@/lib/format";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your requests" };

const OK: Record<string, string> = {
  submitted: "Sent. It's with us now - you'll see the answer here.",
  withdrawn: "Withdrawn. We won't action it.",
};

const ERRORS: Record<string, string> = {
  notopen:
    "That one has already been answered, so it can't be withdrawn. The answer is below.",
};

/**
 * Everything this client has ever asked for, and what came of it.
 *
 * ---- Why a declined request keeps its reason on screen --------------------
 *
 * The obvious design is to drop declined ones out of the list, or grey them into a
 * collapsed section. Both are wrong here. A refusal to pay somebody is the single thing on
 * this host most likely to be argued about later, and the argument goes badly for everyone
 * if the person refused cannot re-read the reason they were given. So a decline is a full
 * row with the note in it, permanently, in the requester's own view - the same string
 * staff typed, not a summary of it.
 */
export default async function PayRequestsPage({
  searchParams,
}: {
  searchParams: { ok?: string; error?: string };
}) {
  const user = await requirePayUser();
  const requests = await listRequestsFor(user.account.id);

  return (
    <div className="mx-auto max-w-3xl">
      <Kicker>Payments</Kicker>
      <h1 className="display mt-4 text-4xl leading-none sm:text-5xl">Your requests</h1>
      <p className="mt-4 max-w-xl text-muted">
        Payments you have told us about, and payments you have asked us for. Nothing here
        is a record of money moving - that is what your{" "}
        <Link href="/statements" className="link-underline text-accent">
          statement
        </Link>{" "}
        is for.
      </p>

      {searchParams.ok ? (
        <p className="mt-8 border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
          {OK[searchParams.ok] ?? "Done."}
        </p>
      ) : null}
      {searchParams.error ? (
        <p className="mt-8 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {ERRORS[searchParams.error] ?? "That didn't work."}
        </p>
      ) : null}

      {requests.length === 0 ? (
        <div className="card mt-10 p-8 text-center">
          <p className="text-muted">You haven&apos;t sent us anything yet.</p>
          <p className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
            <Link href="/make-payment" className="text-accent hover:underline">
              Tell us about a payment →
            </Link>
            <Link href="/request-payment" className="text-accent hover:underline">
              Request a payment →
            </Link>
          </p>
        </div>
      ) : (
        <ul className="mt-10 space-y-4">
          {requests.map((r) => (
            <RequestCard key={r.id} request={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RequestCard({ request: r }: { request: PaymentRequest }) {
  const cfg = requestKindConfig(r.kind);
  const isOpen = r.status === PaymentRequestStatus.OPEN;
  // Off the config, not off a kind comparison. There are now two kinds that mean "money
  // coming to you" - a free-form REQUEST and a RELEASE against a document - and a
  // hard-coded `=== REQUEST` silently rendered the second one in the wrong colour, as
  // money going the other way.
  const outbound = cfg.direction === "outbound";

  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            {/* The CLIENT's wording, not the staff queue's. The same row reads
                "Payment to RO. Nation LIVE" here and "Incoming payment" there, which is
                right - they are two sides of one transaction, and each side names it from
                where they are standing. Both strings live in requestKindConfig. */}
            <span className="font-semibold text-fg">{cfg.label}</span>
            <RequestStatusBadge status={r.status} />
          </p>
          <p className="mt-1 truncate text-sm text-muted">{r.reference}</p>
          <p className="mt-1 text-[11px] text-faint">
            Sent {formatDate(r.createdAt)} by {r.submittedByName}
            {r.externalRef ? (
              <>
                {" "}
                · ref <span className="font-mono">{r.externalRef}</span>
              </>
            ) : null}
          </p>
        </div>

        <p
          className={`shrink-0 font-display text-3xl tabular-nums ${
            outbound ? "text-accent" : "text-fg"
          }`}
        >
          {formatRobux(r.amountRobux)}
        </p>
      </div>

      {r.detail ? (
        <p className="mt-4 whitespace-pre-wrap border-l-2 border-line pl-4 text-sm leading-relaxed text-muted">
          {r.detail}
        </p>
      ) : null}

      {/* ---- The answer, whatever it was -------------------------------- */}
      {r.status === PaymentRequestStatus.DECLINED ? (
        <div className="mt-4 border-l-2 border-red-500/40 pl-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">
            Why this was declined
          </p>
          <p className="mt-1 text-sm leading-relaxed text-fg">
            {r.reviewNote ?? "No reason was recorded."}
          </p>
        </div>
      ) : null}

      {r.status === PaymentRequestStatus.ACCEPTED ? (
        <p className="mt-4 text-sm text-muted">
          Agreed.{" "}
          {r.reviewNote ? <span className="text-fg">“{r.reviewNote}” </span> : null}
          {r.kind === PaymentRequestKind.RELEASE ? (
            <>
              The funds have been released and the document is marked paid on your{" "}
              <Link href="/statements" className="link-underline text-accent">
                statement
              </Link>
              .
            </>
          ) : (
            <>
              The document for it appears on your{" "}
              <Link href="/statements" className="link-underline text-accent">
                statement
              </Link>{" "}
              once it has been issued.
            </>
          )}
        </p>
      ) : null}

      {/* ---- Taking it back ---------------------------------------------- */}
      {isOpen ? (
        <form action={withdrawPaymentRequest} className="mt-4 border-t border-line pt-4">
          <input type="hidden" name="id" value={r.id} />
          <ConfirmButton
            message="Withdraw this request? We won't action it. You can always send another."
            className="text-xs font-semibold text-muted underline transition-colors hover:text-red-400"
          >
            Withdraw this request
          </ConfirmButton>
        </form>
      ) : null}
    </li>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { PaymentRequestStatus } from "@prisma/client";
import { requirePayUser } from "@/lib/pay";
import {
  PARTNER_SEEN_COOKIE,
  countNewForPartner,
  parsePartnerSeen,
} from "@/lib/partner-seen";
import {
  listDocumentsForPartnerAccount,
  partnerLedger,
} from "@/lib/accounting/documents";
import { listRequestsFor } from "@/lib/accounting/requests";
import { kindConfig } from "@/lib/accounting/kinds";
import { documentUrl } from "@/lib/accounting/urls";
import { formatRobux } from "@/lib/tickets/pricing";
import { formatDate } from "@/lib/format";
import { Kicker } from "@/components/ui";
import { DocumentStatusBadge } from "@/components/accounting/document-status-badge";
import { RequestStatusBadge } from "@/components/accounting/request-status-badge";
import { PartnerLedgerStrip } from "@/components/partner/ledger-strip";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Overview" };

/**
 * pay.ronation.live - where a client lands.
 *
 * One question, answered before anything else: where do I stand. The ledger strip is the
 * same PartnerLedgerStrip the /partner area uses, reading the same partnerLedger() over
 * the same rows, so the two pages cannot come to disagree about what somebody is owed.
 *
 * Below it, the two things they might want to do and the last few documents - not the
 * whole list, which is what /statements is for. A landing page that is a table is a
 * landing page nobody reads the top of.
 */
export default async function PayOverviewPage() {
  const user = await requirePayUser();

  const [docs, requests] = await Promise.all([
    listDocumentsForPartnerAccount(user.account.id),
    listRequestsFor(user.account.id),
  ]);
  const ledger = partnerLedger(docs);
  const recent = docs.slice(0, 5);
  const openRequests = requests.filter(
    (r) => r.status === PaymentRequestStatus.OPEN,
  );

  // READ, never advanced - /statements is what marks the list read. Landing here and being
  // told "2 new" must not be what consumes the 2. See lib/partner-seen.ts.
  const lastSeen = parsePartnerSeen(cookies().get(PARTNER_SEEN_COOKIE)?.value);
  const newCount = countNewForPartner(docs, lastSeen);

  return (
    <div className="mx-auto max-w-4xl">
      <Kicker>Payments</Kicker>
      <h1 className="display mt-4 text-4xl leading-none sm:text-5xl">
        {user.account.name}
      </h1>
      <p className="mt-4 max-w-xl text-muted">
        Everything RO. Nation LIVE has raised with you, what it adds up to, and the two
        ways to start something — telling us about a payment you are sending, or asking
        us for one. Every figure is in Robux.
      </p>

      {docs.length ? <PartnerLedgerStrip ledger={ledger} href="/statements" /> : null}

      {newCount > 0 ? (
        <Link
          href="/statements"
          className="group mt-8 flex items-center gap-3 rounded-brand border border-accent/40 bg-accent-soft px-4 py-3 transition-colors hover:border-accent"
        >
          <span className="text-[10px] font-bold uppercase tracking-kicker text-accent">
            New
          </span>
          <span className="text-sm text-fg">
            {newCount} document{newCount === 1 ? "" : "s"} raised since your last visit
          </span>
          <span
            aria-hidden
            className="ml-auto text-accent transition-transform group-hover:translate-x-1"
          >
            →
          </span>
        </Link>
      ) : null}

      {/* ---- The two doors ---------------------------------------------- */}
      <section className="mt-10 grid gap-3 sm:grid-cols-2">
        <Door
          href="/make-payment"
          title="Tell us about a payment"
          blurb="You are sending Robux, or already have. Tell us so it can be matched and receipted."
        />
        <Door
          href="/request-payment"
          title="Request a payment"
          blurb="Ask us for money — a payout you are expecting, work delivered, an expense."
        />
      </section>

      {openRequests.length ? (
        <p className="mt-4 text-sm">
          <Link href="/requests" className="text-accent hover:underline">
            {openRequests.length} request{openRequests.length === 1 ? "" : "s"} still
            waiting on us →
          </Link>
        </p>
      ) : null}

      {/* ---- Recent documents ------------------------------------------- */}
      <section className="mt-12">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[11px] uppercase tracking-kicker text-faint">
            Recent documents
          </h2>
          {docs.length > recent.length ? (
            <Link href="/statements" className="text-sm text-accent hover:underline">
              All {docs.length} →
            </Link>
          ) : null}
        </div>

        {recent.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-muted">Nothing here yet.</p>
            <p className="mt-2 text-sm text-faint">
              When we raise a payout, invoice, receipt or credit note with you, it appears
              here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {recent.map((d) => {
              const href = documentUrl(d);
              return (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3.5"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-fg">
                        {kindConfig(d.kind).heading}
                      </span>
                      <DocumentStatusBadge status={d.status} />
                    </span>
                    <span className="block truncate text-xs text-muted">{d.title}</span>
                    <span className="block font-mono text-[11px] text-faint">
                      {d.number ?? "—"} · {formatDate(d.documentDate)}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-4">
                    <span className="tnum text-sm">{formatRobux(d.total)}</span>
                    {/* A plain <a>: a document lives on the accounts host. See the note
                        on documentUrl() in lib/accounting/urls.ts. */}
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="link-underline whitespace-nowrap text-sm text-accent transition-colors hover:text-fg"
                      >
                        View ↗
                      </a>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---- What we are still deciding on ------------------------------- */}
      {requests.length ? (
        <section className="mt-12">
          <h2 className="mb-4 text-[11px] uppercase tracking-kicker text-faint">
            Your latest requests
          </h2>
          <ul className="divide-y divide-line border-y border-line">
            {requests.slice(0, 3).map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3.5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-fg">{r.reference}</span>
                  <span className="block text-[11px] text-faint">
                    {formatDate(r.createdAt)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="tnum text-sm text-muted">
                    {formatRobux(r.amountRobux)}
                  </span>
                  <RequestStatusBadge status={r.status} />
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            <Link href="/requests" className="text-accent hover:underline">
              All your requests →
            </Link>
          </p>
        </section>
      ) : null}
    </div>
  );
}

function Door({
  href,
  title,
  blurb,
}: {
  href: string;
  title: string;
  blurb: string;
}) {
  return (
    <Link
      href={href}
      className="card flex items-start justify-between gap-4 p-5 transition-colors hover:border-accent/50"
    >
      <span className="min-w-0">
        <span className="block font-semibold text-fg">{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-muted">{blurb}</span>
      </span>
      <span aria-hidden className="shrink-0 text-sm text-accent">
        →
      </span>
    </Link>
  );
}

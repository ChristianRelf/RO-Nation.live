import type { Metadata } from "next";
import Link from "next/link";
import { requireCompanyUser } from "@/lib/company";
import { AccountingShell } from "@/components/accounting/accounting-shell";
import { AdminHeader } from "@/components/admin-ui";
import { RefundForm } from "@/components/accounting/refund-form";
import { DocumentStatusBadge } from "@/components/accounting/document-status-badge";
import { LocalTime } from "@/components/local-time";
import { formatRobux } from "@/lib/tickets/pricing";
import { lookupTicketForRefund } from "@/lib/accounting/refunds";
import { listDocuments } from "@/lib/accounting/documents";
import { createTicketRefund } from "@/app/actions/accounting";
import { outboundUrls } from "@/lib/accounting/urls";
import { DocumentKind } from "@prisma/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Refund a ticket" };

/**
 * Refund a ticket.
 *
 * Its own route rather than a kind in the generic builder, because a refund is the one
 * document here whose figures are NOT free text: the amount is capped at what the holder
 * actually paid, and that cap only exists if the document is written from the ticket.
 * Reachable from the accounting hub; never from the "new document" cards.
 *
 * Two steps on one page. Find the ticket, then decide - so nothing about the money is on
 * screen until the right ticket is on screen with it.
 */
export default async function RefundPage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  const user = await requireCompanyUser();

  const code = (searchParams.code ?? "").trim();
  const target = code ? await lookupTicketForRefund(code) : null;

  // What has been refunded before, on this ticket - shown in full rather than folded
  // into the ceiling, because "already refunded twice" is something the person about to
  // write a third one needs to actually see.
  const priorRefunds = target
    ? (await listDocuments({ kind: DocumentKind.TICKET_REFUND })).filter(
        (d) => d.ticketId === target.ticketId,
      )
    : [];

  return (
    <AccountingShell user={user}>
      <AdminHeader
        title="Refund a ticket"
        subtitle="Exceptional cases only. Tickets are ordinarily non-refundable - every refund here is an authorisation that gets a number, a reason and a name against it."
      />

      <p className="mb-6 text-sm">
        <Link href="/" className="text-muted hover:text-fg">
          ← Accounting
        </Link>
      </p>

      {/* What this document actually does, said before anything is written. A refund
          page that implies the money moves by itself is a page that causes an argument
          with a ticket holder later. */}
      <div className="card mb-8 border-amber-400/30 bg-amber-400/[0.04] p-5">
        <p className="text-sm font-semibold text-amber-300">
          This authorises a refund. It does not send the Robux.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The original purchase went through Roblox, and no code here can reverse it -
          Roblox took its 30% at the point of sale and that share does not come back
          either. What this produces is a numbered document saying who is owed what and
          why. Somebody then has to pay it out by hand.
        </p>
      </div>

      {/* ---- Step one: find the ticket ---------------------------------- */}
      <form method="GET" className="card mb-8 flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Ticket code
          </span>
          <input
            name="code"
            defaultValue={code}
            required
            placeholder="RN-7F3A9C"
            autoComplete="off"
            className="w-full rounded-lg border border-line bg-elev px-3 py-2 text-sm uppercase tracking-wide text-fg"
          />
        </label>
        <button type="submit" className="btn shrink-0">
          Find ticket
        </button>
      </form>

      {code && !target ? (
        <p className="card p-6 text-sm text-muted">
          No ticket matches <span className="font-mono text-fg">{code}</span>. Check the
          code - it looks like <span className="font-mono">RN-7F3A9C</span>.
        </p>
      ) : null}

      {/* ---- Step two: the ticket, then the decision -------------------- */}
      {target ? (
        <>
          <section className="card mb-6 p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-3">
              <div>
                <p className="font-mono text-lg font-semibold text-fg">{target.code}</p>
                <p className="text-sm text-muted">
                  {target.eventTitle} ·{" "}
                  <LocalTime value={target.eventStartsAt} mode="date" />
                </p>
              </div>
              <span className="text-xs uppercase tracking-wide text-muted">
                {target.status.replace("_", " ").toLowerCase()}
              </span>
            </div>

            <dl className="grid gap-4 text-sm sm:grid-cols-4">
              <Fact label="Holder" value={target.holderName} />
              <Fact label="Tier" value={target.tierName ?? "General admission"} />
              <Fact
                label="Paid"
                value={formatRobux(target.paid)}
                hint={
                  target.payments > 1
                    ? `across ${target.payments} payments`
                    : undefined
                }
              />
              <Fact
                label="Refundable"
                value={formatRobux(target.refundable)}
                hint={
                  target.alreadyRefunded
                    ? `${formatRobux(target.alreadyRefunded)} already refunded`
                    : undefined
                }
              />
            </dl>
          </section>

          {priorRefunds.length ? (
            <section className="card mb-6 p-5">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                Already refunded on this ticket
              </h2>
              <ul className="space-y-2 text-sm">
                {priorRefunds.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3">
                    <Link
                      href={`/${r.id}`}
                      className="text-fg hover:text-accent"
                    >
                      {r.number ?? "Draft"}
                    </Link>
                    <span className="flex items-center gap-3">
                      <span className="tabular-nums text-muted">
                        {formatRobux(r.total)}
                      </span>
                      <DocumentStatusBadge status={r.status} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {target.paid <= 0 ? (
            <p className="card p-6 text-sm text-muted">
              Nothing was ever paid for this ticket, so there is nothing to refund. A free
              or comped ticket can be voided from{" "}
              <a href={outboundUrls.tickets()} className="text-accent hover:underline">
                Tickets ↗
              </a>
              , but a refund would be inventing money.
            </p>
          ) : target.refundable <= 0 ? (
            <p className="card p-6 text-sm text-muted">
              This ticket has already been refunded in full.
            </p>
          ) : (
            <RefundForm
              action={createTicketRefund}
              ticketId={target.ticketId}
              code={target.code}
              holderName={target.holderName}
              refundable={target.refundable}
              canVoid={target.canVoid}
              voidHint={
                target.alreadyCancelled
                  ? "This ticket is already cancelled, so there's nothing left to cancel. The refund can still be written."
                  : "They've already checked in, so the ticket can't be cancelled - they were in the room. The refund can still be written."
              }
            />
          )}
        </>
      ) : null}
    </AccountingShell>
  );
}

function Fact({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-faint">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-fg">{value}</dd>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

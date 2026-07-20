import Link from "next/link";
import type { RosterScope } from "@/lib/portal-scope";
import { getSettlement } from "@/lib/settlement";
import { StatCard } from "@/components/admin-ui";
import { formatRobux } from "@/lib/tickets/pricing";
import { groupCount } from "@/lib/tickets/crowd";
import { formatDate } from "@/lib/format";

// The Robux settlement statement for one scope. Read-only. Shared by /shasha and a
// partner portal, like analytics - and, like analytics, every figure is counted from
// the real ledger (TicketPurchase), never estimated.

export async function ScopeSettlement({ scope }: { scope: RosterScope }) {
  const { totalRobux, totalPayments, shows, payout, capped } = await getSettlement(
    scope.eventScope,
  );

  // A partner is a PAYEE - RNL owes them their share, so they get an invoice. RNL's
  // own shows (SHASHA, eventScope null) have no external party to pay, so no invoice.
  const invoiceHref = scope.eventScope ? `${scope.basePath}/invoice` : null;

  return (
    <section>
      <div className="mb-6 border-b border-line pb-4">
        <h2 className="font-display text-2xl uppercase">Payouts</h2>
        <p className="mt-2 text-sm text-muted">
          What {scope.name} has taken in Robux, from the payment ledger. Counted per
          show, so a statement reconciles against the room.
        </p>
      </div>

      {/* The honest banner: paid tickets are off, so this is empty on purpose today. */}
      {totalPayments === 0 ? (
        <div className="mb-6 rounded-2xl border border-line bg-elev p-5 text-sm text-muted">
          <p className="font-semibold text-fg">Nothing to settle yet.</p>
          <p className="mt-1">
            Robux ticket sales are switched off platform-wide right now, so no paid
            tickets have been recorded. When they are turned on, every sale lands here
            automatically - the ledger has been ready all along.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Gross taken" value={formatRobux(totalRobux)} />
        <StatCard label="Paid tickets" value={groupCount(totalPayments)} />
        <StatCard
          label={scope.eventScope ? "Owed to you" : "RNL keeps"}
          value={formatRobux(scope.eventScope ? payout.partnerPayout : payout.afterRoblox)}
        />
      </div>

      {/* How the gross settles. Roblox's 30% comes off at source; RNL's 10% is taken
          from what's left; the partner is paid the rest. Shown even at zero so the
          split is legible before any money moves. */}
      <div className="mt-6 card p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          How this settles
        </p>
        <dl className="space-y-2 text-sm">
          <FeeRow label="Gross (buyers paid)" value={formatRobux(payout.gross)} />
          <FeeRow label="Roblox fee (30%)" value={`− ${formatRobux(payout.robloxFee)}`} muted />
          <FeeRow label="Received by RNL" value={formatRobux(payout.afterRoblox)} />
          <FeeRow label="RNL platform fee (10%)" value={`− ${formatRobux(payout.rnlFee)}`} muted />
          <div className="mt-1 border-t border-line pt-2">
            <FeeRow
              label={scope.eventScope ? `Payable to ${scope.name}` : "RNL retains"}
              value={formatRobux(scope.eventScope ? payout.partnerPayout : payout.afterRoblox)}
              strong
            />
          </div>
        </dl>

        {invoiceHref ? (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link href={invoiceHref} className="btn btn-accent">
              Generate invoice
            </Link>
            <span className="text-xs text-faint">
              A printable payout statement - save it as a PDF from your browser.
            </span>
          </div>
        ) : null}
      </div>

      {shows.length ? (
        <div className="mt-8">
          {capped ? (
            <p className="mb-3 text-xs text-amber-300/80">
              Showing the most recent {groupCount(totalPayments)} payments - the totals
              above are for this window, not all time.
            </p>
          ) : null}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-5 py-3 font-semibold">Show</th>
                    <th className="px-5 py-3 font-semibold">When</th>
                    <th className="px-5 py-3 text-right font-semibold">Paid tickets</th>
                    <th className="px-5 py-3 text-right font-semibold">Robux</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {shows.map((s) => (
                    <tr key={s.eventId} className="hover:bg-fg/[0.02]">
                      <td className="px-5 py-4 font-medium">{s.title}</td>
                      <td className="px-5 py-4 text-muted">{formatDate(s.startsAt)}</td>
                      <td className="px-5 py-4 text-right tabular-nums">
                        {groupCount(s.payments)}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums font-semibold text-fg">
                        {formatRobux(s.robux)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function FeeRow({
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
      <dt className={strong ? "font-semibold text-fg" : muted ? "text-faint" : "text-muted"}>
        {label}
      </dt>
      <dd
        className={`tabular-nums ${
          strong ? "font-display text-lg text-fg" : muted ? "text-faint" : "text-fg"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

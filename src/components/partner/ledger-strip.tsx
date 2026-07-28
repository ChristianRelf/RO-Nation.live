import Link from "next/link";
import type { PartnerLedger } from "@/lib/accounting/documents";
import { formatRobux } from "@/lib/tickets/pricing";

/**
 * The partner's position, as figures, from THEIR side of the table.
 *
 * One component rather than one per page: the overview and the accounting list both open
 * with these numbers, and two copies of "which kinds count as money due to you" is how the
 * front page comes to disagree with the ledger it links to. The arithmetic itself lives
 * further back again, in partnerLedger() - see the note there on why a credit note is not
 * a payout.
 *
 * "Owed by you" is rendered only when it is not zero. A partner RNL has never invoiced is
 * not owing nothing - the column does not apply to them at all, and a zero under a money
 * label is read as a balance rather than as an absence.
 */
export function PartnerLedgerStrip({
  ledger,
  href,
}: {
  ledger: PartnerLedger;
  /** Where "n unsettled" points. Omitted on the accounting page - you are already there. */
  href?: string;
}) {
  const year = new Date().getFullYear();

  return (
    <div className="mt-10 border-y border-line py-6">
      <dl className="flex flex-wrap gap-x-12 gap-y-6">
        <Figure
          label="Due to you"
          value={formatRobux(ledger.dueToPartner)}
          tone={ledger.dueToPartner > 0 ? "accent" : undefined}
        />
        {ledger.dueFromPartner !== 0 ? (
          <Figure
            label="Owed by you"
            value={formatRobux(ledger.dueFromPartner)}
            tone="alert"
          />
        ) : null}
        <Figure
          label={`Paid to you in ${year}`}
          value={formatRobux(ledger.paidToPartnerYtd)}
        />
      </dl>

      {ledger.outstandingCount > 0 ? (
        <p className="mt-6 text-xs text-muted">
          {ledger.outstandingCount} document
          {ledger.outstandingCount === 1 ? " is" : "s are"} issued and unsettled
          {href ? (
            <>
              {". "}
              <Link
                href={href}
                className="link-underline font-semibold text-accent transition-colors hover:text-fg"
              >
                Open accounting
              </Link>
            </>
          ) : (
            " - they're in the list below."
          )}
        </p>
      ) : null}
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "accent" | "alert";
}) {
  return (
    <div>
      <dd
        className={`tnum display text-3xl leading-none ${
          tone === "alert" ? "text-amber-300" : tone === "accent" ? "text-accent" : ""
        }`}
      >
        {value}
      </dd>
      <dt className="mt-2 text-[10px] font-bold uppercase tracking-kicker text-faint">
        {label}
      </dt>
    </div>
  );
}

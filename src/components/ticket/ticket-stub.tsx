import Link from "next/link";
import { dateBlock, formatDate, formatTime } from "@/lib/format";
import { priceLabel } from "@/lib/tickets/pricing";
import { TicketQR } from "./ticket-qr";
import type { TicketArtStatus } from "./ticket-art";

// The wallet row. The same object as TicketArt - punched notches, perforated
// seam, cream stub - shrunk to a list item, so a ticket looks like the same
// ticket whether it is in the wallet or open on the table.
//
// The QR here is small and real, and it is decoration with a use: it opens this
// ticket's page. Nobody scans it at a door - the door knows you by your Roblox
// account (lib/tickets/verify.ts). It is here because a ticket without a mark on
// the stub does not look like a ticket.
//
// ---- The seal reaches this far too ----------------------------------------
//
// `code` is NULLABLE, and that is not a convenience.
//
// The detail page goes to real lengths to keep the code out of the markup until
// the holder activates - it is why the ticket is addressed by opaque id and not
// by code (app/tickets/[id]/page.tsx). This row used to take the code
// unconditionally and print it under the QR, so every sealed ticket in the wallet
// showed a "Sealed" placeholder with the code in plain text directly beneath it.
// The lock was drawn with the key taped to it, one click from the page that
// bothered.
//
// So: the wallet passes null while sealed, and the code line gets the same
// withheld treatment the mark already got.

const STATUS: Record<TicketArtStatus, { label: string; className: string }> = {
  RESERVED: {
    label: "Reserved",
    className: "border-accent/30 bg-accent-soft text-accent",
  },
  CHECKED_IN: {
    label: "Checked in",
    className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "border-red-500/30 bg-red-500/10 text-red-400",
  },
};

export function TicketStub({
  code,
  eventTitle,
  startsAt,
  venue,
  tierName,
  priceRobux,
  seatLabel,
  status,
  activated,
  revoked,
  past,
  brandMark,
  qrValue,
  href,
}: {
  /** The printed code. NULL while the ticket is sealed - see the note above. */
  code: string | null;
  eventTitle: string;
  startsAt: Date | string;
  venue?: string | null;
  tierName: string;
  priceRobux: number;
  /** Where they sit. Null on an unseated show - the row then reads exactly as before. */
  seatLabel?: string | null;
  status: TicketArtStatus;
  activated: boolean;
  /**
   * Withdrawn by the crew, rather than cancelled by the holder.
   *
   * A SEPARATE FLAG, not a fourth key in STATUS above, because revocation is
   * orthogonal to status: a revoked ticket is a CANCELLED one that also carries a
   * stamp. Fold it into the status record and the two facts can no longer both be
   * true, which is exactly the mistake the schema spends twenty lines avoiding.
   */
  revoked?: boolean;
  /** The show has been. Changes how the row is drawn - see the note at the Link. */
  past?: boolean;
  brandMark: string;
  /** The URL the QR encodes. NULL while the ticket is still sealed. */
  qrValue: string | null;
  href: string;
}) {
  const { day, month } = dateBlock(startsAt);
  const s = STATUS[status];
  const cancelled = status === "CANCELLED";

  return (
    // ---- Three treatments, not two -----------------------------------------
    //
    // `opacity-55 saturate-0` used to apply to everything in the old "Past &
    // cancelled" bucket, which drew a show somebody actually went to in the exact
    // visual language of a void one: greyed out and drained. A cancelled ticket
    // SHOULD look dead. A stub you kept should look like a stub you kept.
    //
    // So: cancelled stays drained; a past ticket dims a little and keeps its
    // colour; a live one is untouched.
    <Link
      href={href}
      className={`group ticket-mini block transition-transform duration-300 hover:-translate-y-0.5 ${
        cancelled ? "opacity-55 saturate-0" : past ? "opacity-80" : ""
      }`}
    >
      <div className="flex">
        {/* ---- Body ---- */}
        <div className="ticket-foil relative flex flex-1 items-center gap-4 overflow-hidden bg-surface p-4 sm:gap-5 sm:p-5">
          <div className="ticket-guilloche pointer-events-none absolute inset-0" />

          <div className="relative flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-brand border border-line bg-bg leading-none">
            <span className="display text-xl">{day}</span>
            <span className="mt-1 text-[9px] font-bold tracking-[0.14em] text-accent">
              {month}
            </span>
          </div>

          <div className="relative min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center rounded-brand border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${s.className}`}
              >
                {/* "Withdrawn" rather than "Cancelled" when it was the crew's doing.
                    Member language: the staff surfaces say REVOKED in caps and that
                    is their vocabulary, not the holder's. */}
                {revoked ? "Withdrawn" : s.label}
              </span>
              {activated && !cancelled ? (
                <span className="inline-flex items-center rounded-brand border border-line px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
                  Activated
                </span>
              ) : null}
            </div>

            <h3 className="display mt-2 truncate text-lg">{eventTitle}</h3>

            <p className="mt-1 truncate text-xs text-muted">
              {formatTime(startsAt)} · {formatDate(startsAt)}
              {venue ? ` · ${venue}` : ""}
            </p>
            <p className="mt-0.5 truncate text-xs">
              <span className="text-faint">{tierName}</span>
              <span className="text-faint"> · </span>
              <span
                className={priceRobux > 0 ? "text-accent" : "text-faint"}
              >
                {priceLabel(priceRobux)}
              </span>
            </p>

            {/* The seat, in the wallet. Its own line rather than a third item on the one
                above: "General Admission · Free · Balcony Left · Row K · Seat 12" truncates
                to nonsense on a phone, and the seat is the half you opened the wallet to
                check. */}
            {seatLabel ? (
              <p className="mt-0.5 truncate text-xs font-semibold text-fg">
                {seatLabel}
              </p>
            ) : null}
          </div>
        </div>

        {/* ---- Stub ---- */}
        <div className="ticket-mini-stub panel-paper flex shrink-0 flex-col items-center justify-center gap-1.5 p-2">
          {qrValue ? (
            <TicketQR value={qrValue} size={72} mark={brandMark} />
          ) : (
            <div className="grid h-[72px] w-[72px] place-items-center border border-dashed border-paper-ink/25 text-center">
              <span className="text-[8px] font-bold uppercase leading-tight tracking-[0.1em] text-paper-ink/45">
                {cancelled ? "Void" : "Sealed"}
              </span>
            </div>
          )}
          {/* Withheld with the mark, never beside it. */}
          <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-paper-ink">
            {code ?? (
              <span className="tracking-[0.24em] text-paper-ink/40">------</span>
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}

import Link from "next/link";
import { dateBlock, formatDate, formatTime } from "@/lib/format";
import { priceLabel } from "@/lib/tickets/pricing";
import { TicketQR } from "./ticket-qr";
import type { TicketArtStatus } from "./ticket-art";

// The wallet row. The same object as TicketArt - punched notches, perforated
// seam, cream stub - shrunk to a list item, so a ticket looks like the same
// ticket whether it is in the wallet or open on the table.
//
// The QR here is small and real. It is a preview, not the thing you present at
// the door: that is the big one on the detail page, which this links to.

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
  status,
  activated,
  brandMark,
  qrValue,
  href,
}: {
  code: string;
  eventTitle: string;
  startsAt: Date | string;
  venue?: string | null;
  tierName: string;
  priceRobux: number;
  status: TicketArtStatus;
  activated: boolean;
  brandMark: string;
  /** The URL the QR encodes. NULL while the ticket is still sealed. */
  qrValue: string | null;
  href: string;
}) {
  const { day, month } = dateBlock(startsAt);
  const s = STATUS[status];
  const cancelled = status === "CANCELLED";

  return (
    <Link
      href={href}
      className={`group ticket-mini block transition-transform duration-300 hover:-translate-y-0.5 ${
        cancelled ? "opacity-55 saturate-0" : ""
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
                {s.label}
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
          <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-paper-ink">
            {code}
          </span>
        </div>
      </div>
    </Link>
  );
}

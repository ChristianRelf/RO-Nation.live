import { formatDate, formatTime } from "@/lib/format";
import { priceLabel } from "@/lib/tickets/pricing";
import { TicketQR } from "./ticket-qr";

// The ticket, full size. Body on the left, tear-off stub on the right, a
// perforated seam between them and a punched notch at each end of it — the
// geometry lives in globals.css under `.ticket`.
//
// The stub is CREAM and the body is dark, and that is not only a look. The QR
// has to be dark ink on a light field to be readable at all (see ticket-qr.tsx),
// so the mark needs a pale panel to sit on — and a pale tear-off stub is exactly
// what a real ticket has. The constraint and the design agree, which is the only
// reason to trust either of them.

export type TicketArtStatus = "RESERVED" | "CHECKED_IN" | "CANCELLED";

export function TicketArt({
  code,
  eventTitle,
  tagline,
  category,
  startsAt,
  doorsAt,
  venue,
  tierName,
  priceRobux,
  holder,
  status,
  brandMark,
  brandName,
  /** The URL the QR encodes. NULL keeps the stub sealed until they activate. */
  qrValue,
}: {
  code: string;
  eventTitle: string;
  tagline?: string | null;
  category?: string | null;
  startsAt: Date | string;
  doorsAt?: Date | string | null;
  venue?: string | null;
  tierName: string;
  priceRobux: number;
  holder: string;
  status: TicketArtStatus;
  brandMark: string;
  brandName: string;
  qrValue: string | null;
}) {
  const cancelled = status === "CANCELLED";
  const checkedIn = status === "CHECKED_IN";

  return (
    // Dimmed, but NOT desaturated: `saturate-0` also drains the VOID stamp, and a
    // grey VOID at 17% over a grey ticket is a stamp you have to hunt for. The
    // one thing a dead ticket must say clearly is that it is dead.
    <div className={`group ticket ${cancelled ? "opacity-75" : ""}`}>
      <div className="relative flex flex-col sm:flex-row">
        {/* ---- Body ---- */}
        <div className="ticket-foil relative flex-1 overflow-hidden bg-surface p-6 sm:p-7">
          <div className="ticket-guilloche pointer-events-none absolute inset-0" />

          <div className="relative">
            {/* Issuer + what this thing is */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-brand bg-accent text-[11px] font-extrabold tracking-tight text-accent-ink">
                  {brandMark}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                  {brandName}
                </span>
              </div>
              <span className="shrink-0 rounded-brand border border-accent/30 bg-accent-soft px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-accent">
                Admit one
              </span>
            </div>

            <h2 className="display mt-5 text-3xl leading-[0.95] sm:text-4xl">
              {eventTitle}
            </h2>
            {tagline ? (
              <p className="mt-2 line-clamp-1 text-sm text-muted">{tagline}</p>
            ) : null}

            <p className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
              <time className="font-semibold text-fg">
                {formatTime(startsAt)}
              </time>
              <span className="text-faint">·</span>
              <time className="text-fg">{formatDate(startsAt)}</time>
              {venue ? (
                <>
                  <span className="text-faint">·</span>
                  <span className="text-muted">{venue}</span>
                </>
              ) : null}
            </p>

            {/* The data grid a ticket wears: what you hold, who holds it.
                Two columns, not four. A tier is named by whoever set it up —
                "VIP — Front Barrier" — and four columns across a ticket this
                wide gave each one about 100px, which turned the commonest value
                of all into "General Admi…". */}
            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5">
              <Field label="Admission" value={tierName} />
              <Field label="Holder" value={holder} />
              <Field
                label="Doors"
                value={doorsAt ? formatTime(doorsAt) : formatTime(startsAt)}
              />
              <Field
                label="Paid"
                value={priceLabel(priceRobux)}
                accent={priceRobux > 0}
              />
            </dl>

            {/* Microtext — the fine repeated serial real tickets are printed
                with. Decorative, and it does not pretend to be anything else. */}
            <p
              aria-hidden
              className="mt-5 select-none overflow-hidden text-nowrap font-mono text-[6px] leading-none tracking-[0.3em] text-faint/40"
            >
              {`${code} · `.repeat(24)}
            </p>
          </div>

          {/* Overprint. Only ever one of these, and never on a live ticket. */}
          {cancelled ? (
            <Stamp className="text-red-500">Void</Stamp>
          ) : checkedIn ? (
            <Stamp className="text-emerald-400">Checked in</Stamp>
          ) : null}
        </div>

        {/* ---- Stub ---- */}
        <div className="ticket-stub-panel panel-paper relative flex shrink-0 flex-col items-center justify-center gap-3 p-4">
          {qrValue ? (
            <TicketQR value={qrValue} size={132} mark={brandMark} />
          ) : (
            <div className="grid h-[132px] w-[132px] place-items-center border border-dashed border-paper-ink/25 px-3 text-center">
              <span className="text-[10px] font-semibold uppercase leading-snug tracking-[0.12em] text-paper-ink/45">
                {/* A cancelled ticket has no QR either, and telling its holder it
                    is "sealed until activated" invites them to go looking for a
                    button that is not there and would not help. */}
                {cancelled ? (
                  "No longer valid"
                ) : (
                  <>
                    Sealed until
                    <br />
                    activated
                  </>
                )}
              </span>
            </div>
          )}

          <div className="text-center">
            <p className="font-mono text-[13px] font-bold tracking-[0.2em] text-paper-ink">
              {code}
            </p>
            <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.22em] text-paper-ink/50">
              Admit one · Non-transferable
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[9px] font-bold uppercase tracking-[0.16em] text-faint">
        {label}
      </dt>
      <dd
        className={`mt-1 truncate text-sm font-semibold ${
          accent ? "text-accent" : "text-fg"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function Stamp({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <span
        className={`ticket-stamp whitespace-nowrap text-4xl sm:text-5xl ${className}`}
      >
        {children}
      </span>
    </div>
  );
}

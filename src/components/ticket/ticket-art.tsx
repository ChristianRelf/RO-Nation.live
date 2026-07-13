import { formatDate, formatTime } from "@/lib/format";
import { priceLabel } from "@/lib/tickets/pricing";
import { TicketQR } from "./ticket-qr";
import { TicketBarcode } from "./ticket-barcode";

// The ticket. It is meant to read as a physical object somebody printed — a pale
// card lying on a dark table, not a dark card blending into one.
//
// That is why the stock is CREAM while the page is not. It is also what the two
// machine-readable marks require: a QR and a Code 128 both need dark ink on a pale
// field to scan at all (see ticket-qr.tsx and lib/tickets/barcode.ts), so the marks
// need pale paper under them. A dark ticket would have meant two pale patches
// floating on it — exactly the "designed first, made scannable afterwards" look
// this avoids. The constraint and the design agree, which is the only reason to
// trust either of them.
//
// Layout, left to right:
//
//   [ barcode rail ] │ [ body — issuer bar, title, when, who ] ┊ [ stub — QR ]
//
// The rail is the edge you point a laser scanner at; the stub is what a phone
// camera gets. Both carry the same ticket code, and both stay sealed until the
// holder activates — see `revealed`.

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
  /** The issuer's wordmark, printed on the dark bar. NULL falls back to the badge. */
  brandLogo,
  /** The ticket's opaque reference — what the URL is addressed by. Never secret. */
  reference,
  /**
   * The security seal: six characters, HMAC'd from the id and the code.
   *
   * NULL until the ticket is activated, for the same reason the code is: a seal
   * printed beside a hidden code would be half the secret, given away early.
   */
  seal,
  /** The URL the QR encodes. */
  ticketUrl,
  /**
   * Has the holder activated it?
   *
   * Until they have, the code, the barcode and the QR are all withheld — the
   * ticket is real, it just isn't armed. ONE flag rather than three, so there is
   * no way to end up printing a scannable barcode beside a hidden code.
   */
  revealed,
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
  brandLogo: string | null;
  reference: string;
  seal: string | null;
  ticketUrl: string;
  revealed: boolean;
}) {
  const cancelled = status === "CANCELLED";
  const checkedIn = status === "CHECKED_IN";

  return (
    // Dimmed, but NOT desaturated: `saturate-0` would drain the VOID stamp too,
    // and a grey VOID over a grey ticket is a stamp you have to hunt for. The one
    // thing a dead ticket must say clearly is that it is dead.
    <div className={`group ticket ${cancelled ? "opacity-80" : ""}`}>
      <div className="panel-paper relative flex flex-col sm:flex-row">
        {/* ---- Barcode rail ----------------------------------------------
            The scannable edge. Vertical, because that is where a ticket puts it,
            and because a tall thin rail is what a laser scanner is happiest with.
            Hidden on a phone, where there is no room for it and the QR is the mark
            anybody would actually use. */}
        <div className="relative hidden shrink-0 flex-col items-center justify-between gap-3 border-r border-dashed border-paper-ink/25 px-3 py-6 sm:flex">
          <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-paper-ink/40 [writing-mode:vertical-rl]">
            {brandName}
          </span>

          {revealed && !cancelled ? (
            <TicketBarcode value={code} vertical length={196} thickness={42} />
          ) : (
            <div className="grid h-[196px] w-[42px] place-items-center border border-dashed border-paper-ink/20">
              <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-paper-ink/35 [writing-mode:vertical-rl]">
                {cancelled ? "Void" : "Sealed"}
              </span>
            </div>
          )}

          <span className="font-mono text-[9px] font-bold tracking-[0.18em] text-paper-ink/60 [writing-mode:vertical-rl]">
            {revealed && !cancelled ? code : "—"}
          </span>
        </div>

        {/* ---- Body -------------------------------------------------------
            `ticket-foil` and `ticket-guilloche` are the security print: the fine
            engine-turned linework a banknote or a real ticket is guilloched with,
            and a foil sheen that moves. Neither stops a determined forger — nothing
            printed can — but both are a nuisance to reproduce from a screenshot,
            and their absence is instantly obvious next to a genuine one. */}
        <div className="ticket-foil relative min-w-0 flex-1 overflow-hidden">
          <div className="ticket-guilloche pointer-events-none absolute inset-0" />
          {/* The issuer bar: the one dark band on the card, and the loudest place
              the promoter's name appears. A real ticket names its promoter across
              the top, and this is that. */}
          <div className="flex items-center justify-between gap-4 bg-paper-ink px-5 py-3 sm:px-7">
            {brandLogo ? (
              // The real wordmark. Not next/image: the logo can come from the
              // registry or from an upload, and an unconfigured remote host throws
              // there rather than degrading — a promoter's name is not worth a 500.
              // It is a fixed-height, auto-width mark, so a wide logo and a square
              // one both sit on the bar correctly.
              //
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brandLogo}
                alt={brandName}
                className="h-5 w-auto max-w-[200px] object-contain object-left sm:h-6"
              />
            ) : (
              // No artwork: the lettered badge and the name in type. Deliberate,
              // not a gap — see the note in lib/tickets/brand.ts.
              <div className="flex items-center gap-2.5">
                <span className="grid h-6 w-6 place-items-center rounded-brand bg-accent text-[10px] font-extrabold tracking-tight text-accent-ink">
                  {brandMark}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-paper">
                  {brandName}
                </span>
              </div>
            )}
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.24em] text-paper/60">
              Admit one
            </span>
          </div>

          <div className="p-5 sm:p-7">
            {category ? (
              <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-paper-ink/45">
                {category}
              </p>
            ) : null}

            <h2 className="display mt-2 text-3xl leading-[0.95] text-paper-ink sm:text-4xl">
              {eventTitle}
            </h2>
            {tagline ? (
              <p className="mt-2 line-clamp-1 text-sm text-paper-ink/60">
                {tagline}
              </p>
            ) : null}

            {/* When and where — big enough to read across a dark room. */}
            <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-paper-ink/15 pt-4">
              <time className="display text-xl text-paper-ink">
                {formatTime(startsAt)}
              </time>
              <span className="text-paper-ink/30">·</span>
              <time className="text-sm font-semibold text-paper-ink/80">
                {formatDate(startsAt)}
              </time>
              {venue ? (
                <>
                  <span className="text-paper-ink/30">·</span>
                  <span className="text-sm text-paper-ink/60">{venue}</span>
                </>
              ) : null}
            </div>

            {/* What you hold, and who holds it. Two columns, not four: a tier is
                named by whoever set it up ("VIP — Front Barrier"), and four columns
                across a card this wide turned the commonest value of all into
                "General Admi…". */}
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Admission" value={tierName} />
              <Field label="Holder" value={holder} />
              <Field
                label="Doors"
                value={doorsAt ? formatTime(doorsAt) : formatTime(startsAt)}
              />
              <Field label="Paid" value={priceLabel(priceRobux)} />
            </dl>

            {/* The reference and the seal, printed together and low. The seal is
                the second half of the pair — the other copy is down in the
                microtext band — because forging one and forgetting the other is
                how a faked ticket gives itself away. */}
            <div className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-paper-ink/15 pt-4 font-mono text-[9px] tracking-[0.14em] text-paper-ink/50">
              <span>
                REF <span className="text-paper-ink/75">{reference}</span>
              </span>
              <span>
                SEC{" "}
                <span className="font-bold text-paper-ink/75">
                  {seal ?? "••••••"}
                </span>
              </span>
            </div>
          </div>

          {/* ---- Microtext band ------------------------------------------
              The fine repeated serial a real ticket is printed with, run right
              across the foot of the card. It is security print rather than
              decoration: it carries the brand, the reference and the seal, it is
              too small to redraw convincingly by hand, and a screenshot rescaled
              to fit somebody else's forgery turns it to mush. */}
          <p
            aria-hidden
            className="select-none overflow-hidden text-nowrap border-t border-paper-ink/10 bg-paper-ink/[0.04] px-5 py-1.5 font-mono text-[6px] leading-none tracking-[0.28em] text-paper-ink/35 sm:px-7"
          >
            {`${brandName} · ${reference} · ${seal ?? "SEALED"} · `.repeat(12)}
          </p>

          {/* Overprint. Only ever one, and never on a live ticket. */}
          {cancelled ? (
            <Stamp className="text-red-600">Void</Stamp>
          ) : checkedIn ? (
            <Stamp className="text-emerald-700">Checked in</Stamp>
          ) : null}
        </div>

        {/* ---- Stub -------------------------------------------------------- */}
        {/* The seam and the punched notches are drawn in the PAGE colour by
            globals.css, so they read as holes cut through the card rather than
            lines printed on it — which is only true now that the card is pale and
            the page is not. */}
        <div className="ticket-stub-panel relative flex shrink-0 flex-col items-center justify-center gap-3 p-5">
          {revealed && !cancelled ? (
            <TicketQR value={ticketUrl} size={124} mark={brandMark} />
          ) : (
            <div className="grid h-[124px] w-[124px] place-items-center border border-dashed border-paper-ink/25 px-3 text-center">
              <span className="text-[10px] font-semibold uppercase leading-snug tracking-[0.12em] text-paper-ink/45">
                {/* A cancelled ticket has no QR either, and telling its holder it
                    is "sealed until activated" would send them hunting for a button
                    that isn't there and wouldn't help. */}
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
              {revealed && !cancelled ? code : "•••‑••••••"}
            </p>
            <p className="mt-1 font-mono text-[9px] font-bold tracking-[0.16em] text-paper-ink/55">
              SEC {seal ?? "••••••"}
            </p>
            <p className="mt-1.5 text-[8px] font-bold uppercase tracking-[0.2em] text-paper-ink/50">
              {brandName}
            </p>
            <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.2em] text-paper-ink/40">
              Non-transferable
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[9px] font-bold uppercase tracking-[0.16em] text-paper-ink/45">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-semibold text-paper-ink">
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

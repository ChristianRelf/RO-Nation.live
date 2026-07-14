import Link from "next/link";
import { formatDate, formatDateTime, isPast } from "@/lib/format";
import { ticketCalendarHref } from "@/lib/tickets/ics";
import { priceLabel } from "@/lib/tickets/pricing";
import { Celebrate } from "./celebrate";
import { ActivateButton, CancelButton } from "./ticket-actions";
import { TicketArt } from "./ticket-art";
import { TicketDownload } from "./ticket-download";

// The ticket, open. Shared by RNL's route and every partner's - the two pages
// differ only in how they find the ticket and who is allowed to see it, which is
// exactly the part that must NOT be shared.

type Ticket = {
  id: string;
  code: string;
  status: "RESERVED" | "CHECKED_IN" | "CANCELLED";
  createdAt: Date;
  activatedAt: Date | null;
  checkedInAt: Date | null;
  tierName: string | null;
  priceRobux: number;
};

type Event = {
  slug: string;
  title: string;
  tagline: string | null;
  category: string | null;
  venue: string | null;
  placeUrl: string | null;
  startsAt: Date;
  doorsAt: Date | null;
  endsAt: Date | null;
};

export function TicketDetail({
  ticket,
  event,
  holder,
  brandMark,
  brandName,
  brandLogo,
  seal,
  ticketUrl,
  justIssued,
}: {
  ticket: Ticket;
  event: Event;
  holder: string;
  brandMark: string;
  brandName: string;
  /** The issuer's wordmark. NULL falls back to the lettered badge. */
  brandLogo: string | null;
  /** The ticket's security seal. Computed server-side - see lib/tickets/seal.ts. */
  seal: string;
  /** The absolute URL the QR encodes - this page, on this host. */
  ticketUrl: string;
  /** Straight from checkout. Activation throws its own confetti - see ActivateButton. */
  justIssued: boolean;
}) {
  const cancelled = ticket.status === "CANCELLED";
  const checkedIn = ticket.status === "CHECKED_IN";
  const activated = Boolean(ticket.activatedAt);
  const ended = isPast(event.startsAt);

  // Nothing that admits you is shown until you activate: not the QR, not the
  // barcode, and not the code itself. Reserving gets you a place; activating is
  // what arms the ticket, and it is a deliberate, one-way act - so the thing you
  // present should not be sitting there from the moment you paid.
  //
  // A checked-in ticket has obviously already been presented, so there is nothing
  // left to seal. A cancelled one has nothing worth revealing.
  const revealed = !cancelled && (activated || checkedIn);

  const tierName = ticket.tierName ?? "General Admission";

  const calendarHref = ticketCalendarHref({
    // Sealed tickets get a calendar entry with no code in it - the .ics is a
    // data: URI, so it is text in the page, and a code hidden on screen but
    // printed in the markup is not hidden at all.
    code: revealed ? ticket.code : null,
    id: ticket.id,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    doorsAt: event.doorsAt,
    venue: event.venue,
    url: ticketUrl,
    organiser: brandName,
  });

  return (
    <div className="relative">
      <Celebrate when={justIssued} />
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-56" />

      <div className="shell relative pt-16 sm:pt-20">
        <Link href="/tickets" className="text-sm text-muted hover:text-fg">
          ← All tickets
        </Link>
        <p className="kicker mt-6 text-accent">
          {justIssued ? "You're in" : "Your ticket"}
        </p>
        <h1 className="display mt-5 text-4xl sm:text-5xl">
          {justIssued ? "Ticket confirmed" : event.title}
        </h1>
        {justIssued ? (
          <p className="mt-4 max-w-xl text-muted">
            Saved to your wallet. Your ticket code, barcode and QR stay sealed
            until you activate - do that when you&apos;re heading in, and the
            ticket arms itself.
          </p>
        ) : null}
      </div>

      {/* ---- The ticket ---- */}
      <section className="shell py-10">
        <div className="mx-auto max-w-3xl">
          <TicketArt
            code={ticket.code}
            eventTitle={event.title}
            tagline={event.tagline}
            category={event.category}
            startsAt={event.startsAt}
            doorsAt={event.doorsAt}
            venue={event.venue}
            tierName={tierName}
            priceRobux={ticket.priceRobux}
            holder={holder}
            status={ticket.status}
            brandMark={brandMark}
            brandName={brandName}
            brandLogo={brandLogo}
            reference={ticket.id}
            // Withheld with the code, for the same reason: a seal is half of the
            // pair that proves a ticket, and printing it beside a sealed code
            // would hand over the harder half early.
            seal={revealed ? seal : null}
            ticketUrl={ticketUrl}
            revealed={revealed}
          />

          {/* Under the card, on the page rather than printed on the ticket: the
              things that would clutter a real stub but that a holder still wants
              - how the marks are read, and what the code alone will do. */}
          <ul className="mt-6 grid gap-3 text-sm text-muted sm:grid-cols-3">
            <Note title="Two marks, one code">
              The barcode down the side and the QR on the stub carry the same
              ticket. Either scans you in.
            </Note>
            <Note title="No phone? No problem">
              The crew can check you in from the code alone. Read it out at the
              door.
            </Note>
            <Note title="Tied to your account">
              Issued to {holder}. It isn&apos;t transferable, and it won&apos;t
              admit anyone else.
            </Note>
          </ul>
        </div>
      </section>

      <section className="shell grid gap-6 pb-16 lg:grid-cols-[1.1fr_1fr]">
        {/* ---- Next step ---- */}
        <div className="card p-6">
          {cancelled ? (
            <>
              <h2 className="display text-xl">Ticket cancelled</h2>
              <p className="mt-2 text-sm text-muted">
                This ticket is no longer valid and won&apos;t admit you. If the
                show still has room, you can reserve a new one.
              </p>
              {!ended ? (
                <Link
                  href={`/events/${event.slug}/reserve`}
                  className="btn btn-accent mt-5"
                >
                  Reserve again
                </Link>
              ) : null}
            </>
          ) : checkedIn ? (
            <>
              <h2 className="display text-xl">You&apos;re in</h2>
              <p className="mt-2 text-sm text-muted">
                Checked in
                {ticket.checkedInAt
                  ? ` at ${formatDateTime(ticket.checkedInAt)}`
                  : ""}
                . Enjoy the show.
              </p>
            </>
          ) : activated ? (
            <>
              <h2 className="display text-xl">Ready at the door</h2>
              <p className="mt-2 text-sm text-muted">
                Your ticket is armed. Show the QR on the stub, hold up the
                barcode, or read out the code - any of the three checks you in
                inside the experience.
              </p>
              {event.placeUrl ? (
                <a
                  href={event.placeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-accent mt-5"
                >
                  Join the experience →
                </a>
              ) : null}
            </>
          ) : (
            <>
              <h2 className="display text-xl">Ready to go?</h2>
              <p className="mt-2 text-sm text-muted">
                Activating reveals your ticket code, the barcode and the QR - and
                lets you download the ticket. Do it when you&apos;re heading in;
                it can&apos;t be undone.
              </p>
              <ActivateButton ticketId={ticket.id} />
            </>
          )}

          {/* Where it has got to. */}
          <ol className="mt-7 space-y-0 border-t border-line pt-5">
            <Step
              label="Reserved"
              at={ticket.createdAt}
              done
              detail={`${tierName} · ${priceLabel(ticket.priceRobux)}`}
            />
            <Step
              label="Activated"
              at={ticket.activatedAt}
              done={activated}
              detail={activated ? "Code, barcode and QR revealed" : "Not activated yet"}
            />
            <Step
              label="Checked in"
              at={ticket.checkedInAt}
              done={checkedIn}
              detail={checkedIn ? "Admitted at the door" : "At the door"}
              last
            />
          </ol>
        </div>

        {/* ---- Details + actions ---- */}
        <div className="card p-6">
          <h2 className="display text-xl">Ticket details</h2>

          <dl className="mt-4 space-y-3 text-sm">
            {/* The code is withheld with the marks, not shown beside them - a
                sealed QR next to a printed code would be a lock with the key
                taped to it. */}
            <Row
              label="Ticket code"
              value={revealed ? ticket.code : "Sealed until activated"}
              mono={revealed}
            />
            <Row label="Admission" value={tierName} />
            <Row label="Paid" value={priceLabel(ticket.priceRobux)} />
            <Row label="Holder" value={holder} />
            <Row label="Issued by" value={brandName} />
            <Row label="Show" value={formatDate(event.startsAt)} />
            {/* The reference is not secret - it is what this page's URL is
                addressed by - so it shows from the moment the ticket exists. It
                is what to quote to the crew if anything needs looking up before
                you have activated. */}
            <Row label="Reference" value={ticket.id} mono />
            <Row
              label="Security seal"
              value={revealed ? seal : "Sealed until activated"}
              mono={revealed}
            />
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={calendarHref}
              download={`${revealed ? ticket.code : "ticket"}.ics`}
              className="btn btn-ghost"
            >
              Add to calendar
            </a>
            <Link href={`/events/${event.slug}`} className="btn btn-ghost">
              View event
            </Link>

            {/* Downloading a ticket that has not been activated would hand out a
                PNG with a hole where the QR should be. There is nothing to keep
                until it is armed. */}
            {revealed ? (
              <TicketDownload
                ticket={{
                  code: ticket.code,
                  eventTitle: event.title,
                  when: formatDateTime(event.startsAt),
                  venue: event.venue,
                  tierName,
                  holder,
                  paid: priceLabel(ticket.priceRobux),
                  brandName,
                  brandMark,
                  brandLogo,
                  reference: ticket.id,
                  seal,
                  ticketUrl,
                }}
              />
            ) : null}
          </div>

          {!cancelled && !ended ? <CancelButton ticketId={ticket.id} /> : null}
        </div>
      </section>
    </div>
  );
}

function Note({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="rounded-brand border border-line bg-elev p-4">
      <p className="text-[11px] font-bold uppercase tracking-kicker text-accent">
        {title}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{children}</p>
    </li>
  );
}

function Step({
  label,
  at,
  done,
  detail,
  last,
}: {
  label: string;
  at: Date | null;
  done: boolean;
  detail: string;
  last?: boolean;
}) {
  return (
    <li className="flex gap-3.5">
      {/* Rail: a dot, and the line running down to the next one. */}
      <div className="flex flex-col items-center">
        <span
          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
            done ? "bg-accent" : "border border-line-strong bg-bg"
          }`}
        />
        {!last ? (
          <span
            className={`w-px flex-1 ${done ? "bg-accent/40" : "bg-line"}`}
          />
        ) : null}
      </div>

      <div className={last ? "pb-0" : "pb-5"}>
        <p
          className={`text-sm font-semibold ${done ? "text-fg" : "text-faint"}`}
        >
          {label}
        </p>
        <p className="text-xs text-faint">
          {at ? formatDateTime(at) : detail}
        </p>
      </div>
    </li>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/60 pb-3">
      <dt className="shrink-0 text-faint">{label}</dt>
      <dd
        className={`min-w-0 truncate text-right ${
          mono ? "font-mono font-semibold tracking-widest text-fg" : "text-fg"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

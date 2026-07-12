import Link from "next/link";
import { activateTicket, cancelTicket } from "@/app/actions/tickets";
import { formatDateTime, isPast } from "@/lib/format";
import { ticketCalendarHref } from "@/lib/tickets/ics";
import { priceLabel } from "@/lib/tickets/pricing";
import { Celebrate } from "./celebrate";
import { TicketArt } from "./ticket-art";

// The ticket, open. Shared by RNL's route and every partner's — the two pages
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
  ticketUrl,
  justIssued,
  justActivated,
}: {
  ticket: Ticket;
  event: Event;
  holder: string;
  brandMark: string;
  brandName: string;
  /** The absolute URL the QR encodes — this page, on this host. */
  ticketUrl: string;
  justIssued: boolean;
  justActivated: boolean;
}) {
  const cancelled = ticket.status === "CANCELLED";
  const checkedIn = ticket.status === "CHECKED_IN";
  const activated = Boolean(ticket.activatedAt);
  const ended = isPast(event.startsAt);

  // The QR is the thing you present. It stays sealed until they activate — the
  // ritual is the point — but a checked-in ticket has obviously been presented,
  // so there is nothing left to seal.
  const qrValue = !cancelled && (activated || checkedIn) ? ticketUrl : null;

  const tierName = ticket.tierName ?? "General Admission";

  const calendarHref = ticketCalendarHref({
    code: ticket.code,
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
      <Celebrate when={justIssued || justActivated} />
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
            Saved to your wallet. Activate it when you&apos;re heading in — that
            reveals the QR you show at the door.
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
            qrValue={qrValue}
          />
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
                Your ticket is active. Show the QR on the stub — or read out the
                code — and you&apos;ll be checked in inside the experience.
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
                Activating reveals the QR code on your stub. Do it when
                you&apos;re heading in — it can&apos;t be undone.
              </p>
              <form action={activateTicket} className="mt-5">
                <input type="hidden" name="ticketId" value={ticket.id} />
                <button className="btn btn-accent w-full text-base sm:w-auto">
                  Activate ticket 🎉
                </button>
              </form>
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
              detail={activated ? "QR revealed" : "Not activated yet"}
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
            <Row label="Ticket code" value={ticket.code} mono />
            <Row label="Admission" value={tierName} />
            <Row label="Paid" value={priceLabel(ticket.priceRobux)} />
            <Row label="Holder" value={holder} />
            <Row label="Issued by" value={brandName} />
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={calendarHref}
              download={`${ticket.code}.ics`}
              className="btn btn-ghost"
            >
              Add to calendar
            </a>
            <Link href={`/events/${event.slug}`} className="btn btn-ghost">
              View event
            </Link>
          </div>

          {!cancelled && !ended ? (
            <form action={cancelTicket} className="mt-6 border-t border-line pt-5">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <button className="text-sm text-faint transition-colors hover:text-red-400">
                Cancel this ticket
              </button>
              <p className="mt-1.5 text-xs text-faint">
                Frees your spot for someone else. You can reserve again if
                there&apos;s room.
              </p>
            </form>
          ) : null}
        </div>
      </section>
    </div>
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

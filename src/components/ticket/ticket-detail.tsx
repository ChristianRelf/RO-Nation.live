import type { ReactNode } from "react";
import Link from "next/link";
import { isPast, relativeDays } from "@/lib/format";
import { LocalTime } from "@/components/local-time";
import { ticketCalendarHref } from "@/lib/tickets/ics";
import { priceLabel } from "@/lib/tickets/pricing";
import { groupCount, type Crowd } from "@/lib/tickets/crowd";
import { ordinalLabel } from "@/lib/tickets/history";
import { admissionWindow, ticketPhase } from "@/lib/tickets/state";
import type { VenueLayout } from "@/lib/venue/schema";
import { Countdown } from "@/components/countdown";
import { VenueMap } from "@/components/venue/venue-map";
import { Celebrate } from "./celebrate";
import { ActivateButton, CancelButton } from "./ticket-actions";
import { TicketArt } from "./ticket-art";
import { TicketDownload } from "./ticket-download";
import { TicketPulse } from "./ticket-pulse";
import { ShareShow } from "./share-show";

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
  /** Frozen at issue. Null on an unseated show - which is most of them. */
  seatLabel: string | null;

  // ---- Withdrawn by the crew -----------------------------------------------
  //
  // These were missing, and their absence was a lie the page told.
  //
  // A revoked ticket is a CANCELLED one plus a stamp, so with nothing here to read
  // it fell through to the ordinary "you cancelled this" card - and that card
  // offers RESERVE AGAIN, which issueTicket() refuses on exactly this column. We
  // sent somebody who had been banned from the show to a checkout that would turn
  // them away, and let the refusal be the first they heard of it.
  //
  // revokedByName is deliberately NOT read below: which staff member did it is an
  // audit fact for /company, not something the holder needs.
  revokedAt: Date | null;
  revokedReason: string | null;

  /**
   * The terms they accepted, frozen at issue, and when they accepted them.
   *
   * Empty on every ticket issued before the column existed - rendered as nothing at
   * all rather than an empty box, because "we didn't record it" is the truth and an
   * empty list would imply there were no terms.
   */
  termsSnapshot: string[];
  termsAcceptedAt: Date | null;
};

/**
 * Where the seat IS, drawn.
 *
 * The third reader of `<VenueMap>` - the designer draws with it, the picker sells with it,
 * and this shows you what you bought. One renderer, three surfaces, which is the whole
 * reason venue-map.tsx exists: a stub that drew its own map would eventually draw a chair
 * in a place the picker never offered.
 *
 * Undefined on an unseated show, and on a seated one whose map has since been deleted -
 * the ticket still knows its `seatLabel`, so it still SAYS where they sit. The picture is
 * the bonus, not the fact.
 */
type SeatMap = {
  layout: VenueLayout;
  seatKey: string | null;
  sectionKey: string | null;
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
  /**
   * The show's artwork - and until now the ticket did not draw it.
   *
   * It has always been on the row this page loads. The event page opens on it at
   * half the viewport; the ticket to that same show was typography on cream stock
   * with no clue what you had bought a seat at. TicketArt stays exactly as it is
   * (a printed stub does not have a photograph on it), so this sits ABOVE the
   * stub: the poster you were sold, then the ticket it sold you.
   */
  thumbnailUrl: string | null;
};

export function TicketDetail({
  ticket,
  event,
  crowd,
  milestone,
  seatMap,
  holder,
  brandMark,
  brandName,
  brandLogo,
  seal,
  ticketUrl,
  eventUrl,
  justIssued,
}: {
  ticket: Ticket;
  event: Event;
  /** Who else is coming. Optional so a caller that has not counted still renders. */
  crowd?: Crowd;
  /**
   * Which show of theirs this was - 7 for their seventh. Null unless the ticket
   * actually went through the door, which is the only thing that makes it true.
   */
  milestone?: number | null;
  seatMap?: SeatMap;
  holder: string;
  brandMark: string;
  brandName: string;
  /** The issuer's wordmark. NULL falls back to the lettered badge. */
  brandLogo: string | null;
  /** The ticket's security seal. Computed server-side - see lib/tickets/seal.ts. */
  seal: string;
  /** The absolute URL the QR encodes - this page, on this host. */
  ticketUrl: string;
  /** The SHOW's public URL, for sharing. Never this page's - see share-show.tsx. */
  eventUrl: string;
  /** Straight from checkout. Activation throws its own confetti - see ActivateButton. */
  justIssued: boolean;
}) {
  // One function decides where this ticket has got to - see lib/tickets/state.ts for
  // why that is not four booleans any more, and why `ended` is still one of them.
  const phase = ticketPhase(ticket, event);
  const activated = Boolean(ticket.activatedAt);

  // `ended` is a question about the SHOW (has it begun), and it is what gates
  // "reserve again" and the cancel button, so it has to keep agreeing with
  // reserve/page.tsx. `phase === "expired"` is a question about the TICKET and
  // answers GRACE_MS later. Deliberately two things. See the note in state.ts.
  const ended = isPast(event.startsAt);

  // Nothing that identifies your ticket is shown until you activate: not the QR,
  // not the barcode, and not the code itself. Reserving gets you a place;
  // activating is the moment you say you're coming, and it is deliberate and
  // one-way - so the ticket should not be sitting there fully printed from the
  // moment you paid.
  //
  // This is ceremony, not security, and it is worth being honest about which:
  // the door does NOT require it (verify.ts admits an unactivated holder and
  // stamps activatedAt on the way past, rather than turning them away over a
  // ritual they skipped). What it buys is a ticket that comes to life.
  //
  // A checked-in ticket has obviously already been used, so there is nothing left
  // to seal. A cancelled or withdrawn one has nothing worth revealing.
  //
  // Note what does NOT unseal it: doors opening. The show starting is not the
  // holder saying they're coming, and taking the ceremony away from them at the
  // one moment it is worth anything would be a strange way to reward turning up.
  const voided = phase === "revoked" || phase === "cancelled";
  const revealed = !voided && (activated || phase === "checkedIn");

  // ---- Watching for the door ------------------------------------------------
  //
  // Mounted from the SERVER, and only when the answer could plausibly change: they
  // are holding a live ticket and the show is letting people in. A cancelled
  // ticket, a show next month and a ticket that has already been through the door
  // all cost nothing, because the poller is never sent to the browser at all.
  const window = admissionWindow(event);
  const watchTheDoor = (phase === "open" || phase === "armed") && window.live;

  // Freshly through the door - within one poll interval or so. Distinguishes "the
  // door just let me in while I was looking at this" from "I opened my ticket the
  // next morning", which want very different amounts of confetti.
  const justArrived =
    phase === "checkedIn" &&
    Boolean(ticket.checkedInAt) &&
    Date.now() - ticket.checkedInAt!.getTime() < 60_000;

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
      {watchTheDoor ? (
        <TicketPulse ticketId={ticket.id} status={ticket.status} />
      ) : null}
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
            Saved to your wallet. Activate it whenever you like - it prints the
            code, the barcode and the QR onto the stub. You don&apos;t need to:
            when doors open, just join the show and the door knows you.
          </p>
        ) : (
          <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
            <span>{relativeDays(event.startsAt)}</span>
            {event.venue ? (
              <>
                <span className="text-faint">·</span>
                <span>{event.venue}</span>
              </>
            ) : null}
          </p>
        )}
      </div>

      {/* ---- The ticket ---- */}
      <section className="shell py-10">
        <div className="mx-auto max-w-3xl">
          {/* ---- The poster ----
              The show's own artwork, which the ticket to it never showed. Kept OFF
              TicketArt deliberately: the stub is printed stock and a photograph on
              it would stop it reading as a ticket. So the poster sits above, and
              the ticket below it. */}
          {event.thumbnailUrl ? (
            <div className="relative mb-6 overflow-hidden rounded-brand border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.thumbnailUrl}
                alt=""
                className="h-44 w-full object-cover sm:h-56"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
              {event.tagline ? (
                <p className="absolute inset-x-0 bottom-0 p-4 text-sm text-fg sm:p-5">
                  {event.tagline}
                </p>
              ) : null}
            </div>
          ) : null}

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
            seatLabel={ticket.seatLabel}
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

          {/* ---- Where you're sitting ----
              The map, with their own chair lit up. It is drawn by the SAME component the
              designer drew the room with and the picker sold it with, focused on their
              section so the chairs are actually visible - at the overview a single seat in
              a 2,000-seat room is a dot you cannot find.

              Note what is NOT passed: `taken` and `held`. Whose ticket sits in the chair
              next to yours is nobody's business but theirs, and a stub is not a live
              availability view - it is a picture of where YOU are. */}
          {seatMap ? (
            <div className="card mt-6 overflow-hidden p-4 sm:p-5">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-[11px] font-bold uppercase tracking-kicker text-accent">
                  Where you&apos;re sitting
                </p>
                {ticket.seatLabel ? (
                  <p className="min-w-0 truncate text-sm font-semibold text-fg">
                    {ticket.seatLabel}
                  </p>
                ) : null}
              </div>

              <div className="mt-4 aspect-[10/7] w-full">
                <VenueMap
                  layout={seatMap.layout}
                  selected={seatMap.seatKey}
                  focused={seatMap.sectionKey}
                />
              </div>
            </div>
          ) : null}

          {/* ---- Who else is coming ----
              Not on a void ticket, and not after the fact: "1,247 going" is
              anticipation, and on a show that happened last month it is just a
              number. */}
          {crowd && !voided && phase !== "expired" ? (
            <div className="card mt-6 flex flex-wrap items-center gap-x-8 gap-y-4 p-5">
              <CrowdStat value={groupCount(crowd.going)} label="going" />
              {crowd.watching > 0 ? (
                <CrowdStat value={groupCount(crowd.watching)} label="watching" />
              ) : null}
              {crowd.inside ? (
                <CrowdStat
                  value={groupCount(crowd.inside)}
                  label="inside right now"
                  live
                />
              ) : null}
            </div>
          ) : null}

          {/* ---- How you actually get in ------------------------------------
              These three notes used to describe a door that does not exist. They
              said the barcode and the QR each "scan you in" and that the crew
              would take the code at the door - a physical turnstile, on a website
              for shows that happen inside Roblox.

              What really happens: you join the experience, the game server asks
              this site who you are by your Roblox id, and it checks you in
              (lib/tickets/verify.ts - `robloxId` + `eventId`, no code needed).
              Nobody scans anything. Ever.

              The code is not decoration though, and the third note is the honest
              version of the old second one: `code` IS a supported lookup, and it
              is what the web door widget takes when a crew member has to find
              somebody by hand. A backup, not the mechanism. */}
          <ul className="mt-6 grid gap-3 text-sm text-muted sm:grid-cols-3">
            <Note title="Just turn up">
              Join the experience when doors open and you&apos;re in. There&apos;s
              nothing to show and nothing to scan.
            </Note>
            <Note title="Tied to your account">
              Issued to {holder}. The door knows you by your Roblox account, so it
              isn&apos;t transferable and won&apos;t admit anyone else.
            </Note>
            <Note title="The code is the backup">
              If the crew ever needs to find you by hand, your ticket code is what
              they&apos;ll ask for.
            </Note>
          </ul>
        </div>
      </section>

      <section className="shell grid gap-6 pb-16 lg:grid-cols-[1.1fr_1fr]">
        {/* ---- Next step ---- */}
        <div className="card p-6">
          {/* ---- Withdrawn ----
              Its own branch, above cancelled, because it is a different piece of
              news: the crew took this ticket off them. NO "reserve again" - that
              link went to a checkout issueTicket() refuses on exactly this stamp,
              which made the refusal the first they heard of it. */}
          {phase === "revoked" ? (
            <>
              <h2 className="display text-xl">This ticket was withdrawn</h2>
              <p className="mt-2 text-sm text-muted">
                The organisers took this ticket back, so it won&apos;t admit you
                and you can&apos;t reserve another for this show.
              </p>
              {ticket.revokedReason ? (
                <p className="mt-4 rounded-brand border border-line bg-elev p-4 text-sm text-fg">
                  {ticket.revokedReason}
                </p>
              ) : null}
              <p className="mt-4 text-xs text-faint">
                Think this is a mistake? Get in touch with the organisers and
                quote the reference below.
              </p>
              <Link href="/contact" className="btn btn-ghost mt-5">
                Contact the organisers
              </Link>
            </>
          ) : phase === "cancelled" ? (
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
          ) : phase === "checkedIn" ? (
            <>
              <p className="kicker text-accent">Admitted</p>
              <h2 className="display mt-3 text-2xl">You&apos;re in</h2>
              <p className="mt-2 text-sm text-muted">
                Checked in
                {ticket.checkedInAt ? (
                  <>
                    {" "}
                    at <LocalTime value={ticket.checkedInAt} mode="datetime" />
                  </>
                ) : (
                  ""
                )}
                . Enjoy the show.
              </p>
              {/* The number nobody was counting. Their FIRST gets said properly -
                  "your 1st show" is a worse sentence than the thing it means. */}
              {milestone ? (
                <p className="mt-4 rounded-brand border border-line bg-elev px-4 py-3 text-sm">
                  {/* No brand name in here on purpose. The count spans every org
                      whose ticket has ever been in this wallet - see the note in
                      lib/tickets/history.ts - so calling it a Sleep Token show
                      would be wrong on the ticket most likely to say it. */}
                  {milestone === 1 ? (
                    <span className="font-semibold text-fg">
                      Your first show. Welcome.
                    </span>
                  ) : (
                    <>
                      <span className="font-semibold text-fg">
                        Your {ordinalLabel(milestone)} show
                      </span>
                      <span className="text-muted"> — and counting.</span>
                    </>
                  )}
                </p>
              ) : null}
              {/* Fires for somebody who was watching this page when the door let
                  them in - the poller refreshes, this branch renders, and the
                  burst is the acknowledgement they otherwise never got. Not on a
                  ticket they opened days later: `justArrived` is minutes-fresh. */}
              <Celebrate when={justArrived} />
              {event.placeUrl && !ended ? (
                <a
                  href={event.placeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost mt-5"
                >
                  Back to the show →
                </a>
              ) : null}
            </>
          ) : phase === "expired" ? (
            /* ---- Never turned up ----
               The window has shut. There is nothing to activate and nothing to
               join, and offering "Activate ticket 🎉" here - which is what this
               page did - is the cheeriest possible way to tell somebody they
               missed it. Note this lands GRACE_MS after the show starts, not the
               instant it does: a latecomer still gets the live card. */
            <>
              <h2 className="display text-xl">This show has been and gone</h2>
              <p className="mt-2 text-sm text-muted">
                {activated
                  ? "Your ticket was never checked in at the door. Keep the stub - it's yours."
                  : "This ticket was never used. Keep the stub - it's yours."}
              </p>
              <Link href="/events" className="btn btn-ghost mt-5">
                See what&apos;s coming up
              </Link>
            </>
          ) : phase === "open" ? (
            /* ---- DOORS ARE OPEN ----
               The moment the whole page exists for, and until now it did not
               exist at all: doorsAt was stored, formatted and printed, and
               nothing ever compared it to the clock. Joining was a ghost-weight
               link three paragraphs down.

               Now it is the page. One full-width button, lit. */
            <>
              <p className="kicker text-accent">Doors are open</p>
              <h2 className="display mt-3 text-2xl">
                {activated ? "Go and enjoy it" : "Head on in"}
              </h2>
              <p className="mt-2 text-sm text-muted">
                Join the experience and you&apos;re in - the door knows your
                Roblox account, so there&apos;s nothing to show and nothing to
                scan.
              </p>

              {event.placeUrl ? (
                <div className="relative mt-5">
                  <div className="stage-glow pointer-events-none absolute inset-0" />
                  <a
                    href={event.placeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-accent relative w-full justify-center py-4 text-base"
                  >
                    Join the show →
                  </a>
                </div>
              ) : (
                <p className="mt-5 rounded-brand border border-line bg-elev p-4 text-sm text-muted">
                  The organisers haven&apos;t posted the join link yet. It&apos;ll
                  appear here the moment they do.
                </p>
              )}

              {/* Still the hype beat, just no longer the headline: at doors-open
                  the thing to do is GO IN, and activating is the souvenir. It has
                  never been an entry requirement - see the note on `revealed`. */}
              {!activated ? (
                <div className="mt-6 border-t border-line pt-5">
                  <p className="text-sm text-muted">
                    Want the full ticket - code, barcode and QR - to keep?
                  </p>
                  <ActivateButton ticketId={ticket.id} />
                </div>
              ) : null}
            </>
          ) : (
            /* ---- Waiting: `held` and `armed` ----
               Both are "the show hasn't opened yet", and both want the clock.
               The difference is only whether there is still a button to press. */
            <>
              <h2 className="display text-xl">
                {activated ? "You're all set" : "Ready to go?"}
              </h2>
              <p className="mt-2 text-sm text-muted">
                {activated
                  ? "Your ticket's live. When doors open, this card turns into the way in - no code to show, the door knows your Roblox account."
                  : "Activating brings your ticket to life - the code, the barcode and the QR get printed on it, and you can download it to keep. You don't have to: the door knows your Roblox account either way."}
              </p>

              {/* The clock, and the one component built for exactly this. Its zero
                  state reads "DOORS ARE OPEN", which is the RIGHT answer here -
                  the opposite of the situation hold-bar.tsx documents, where a
                  countdown hitting zero means a hold expired and something must
                  be taken away. Don't replace this with a bespoke clock. */}
              <Countdown
                target={(event.doorsAt ?? event.startsAt).toISOString()}
                className="mt-5"
                compact
              />

              {!activated ? <ActivateButton ticketId={ticket.id} /> : null}
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
              done={phase === "checkedIn"}
              detail={phase === "checkedIn" ? "Admitted at the door" : "At the door"}
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
            {ticket.seatLabel ? (
              <Row label="Seat" value={ticket.seatLabel} />
            ) : null}
            <Row label="Paid" value={priceLabel(ticket.priceRobux)} />
            <Row label="Holder" value={holder} />
            <Row label="Issued by" value={brandName} />
            <Row
              label="Show"
              value={<LocalTime value={event.startsAt} mode="date" />}
            />
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

            {/* The SHOW's link, not this page's - see the note in share-show.tsx.
                Not offered on a ticket that is void or long past: "I'm going to
                this" is not a thing to say about either. */}
            {!voided && phase !== "expired" ? (
              <ShareShow url={eventUrl} title={event.title} />
            ) : null}

            {/* Downloading a ticket that has not been activated would hand out a
                PNG with a hole where the QR should be. There is nothing to keep
                until it is armed. */}
            {revealed ? (
              <TicketDownload
                ticket={{
                  code: ticket.code,
                  eventTitle: event.title,
                  startsAtIso: event.startsAt.toISOString(),
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

          {/* ---- What they agreed to ----
              Collapsed, because nobody opens a ticket to read terms - but it is
              THEIR copy, frozen at issue, and the organiser rewriting the show's
              terms tomorrow does not touch it. See Ticket.termsSnapshot. */}
          {ticket.termsSnapshot.length ? (
            <details className="mt-6 border-t border-line pt-5">
              <summary className="cursor-pointer text-sm text-muted hover:text-fg">
                The terms you accepted
                {ticket.termsAcceptedAt ? (
                  <>
                    {" · "}
                    <LocalTime value={ticket.termsAcceptedAt} mode="date" />
                  </>
                ) : (
                  ""
                )}
              </summary>
              <ul className="mt-4 space-y-2.5">
                {ticket.termsSnapshot.map((clause, i) => (
                  <li key={i} className="flex gap-2.5 text-xs leading-relaxed text-muted">
                    <span className="text-faint">{i + 1}.</span>
                    <span>{clause}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {/* `ended`, not `phase === "expired"`: cancelling is about giving a spot
              back to somebody else, and once the show has started there is nobody
              to give it to. The GRACE_MS window that keeps a latecomer's ticket
              alive is not a window in which to hand it back. cancelTicket()
              enforces the same two rules server-side - this only hides the button. */}
          {!voided && !ended ? (
            <CancelButton ticketId={ticket.id} seatLabel={ticket.seatLabel} />
          ) : null}
        </div>
      </section>
    </div>
  );
}

/**
 * One number from the crowd strip.
 *
 * `live` adds the pinging dot Countdown uses for its doors-open state - the same
 * visual grammar for the same fact, so "inside right now" reads as a thing that is
 * happening rather than a thing that was counted.
 */
function CrowdStat({
  value,
  label,
  live,
}: {
  value: string;
  label: string;
  live?: boolean;
}) {
  return (
    <div>
      <p className="display tnum flex items-center gap-2 text-2xl leading-none">
        {live ? (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
        ) : null}
        {value}
      </p>
      <p className="mt-1.5 text-[10px] font-bold uppercase tracking-kicker text-muted">
        {label}
      </p>
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
          {at ? <LocalTime value={at} mode="datetime" /> : detail}
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
  value: ReactNode;
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

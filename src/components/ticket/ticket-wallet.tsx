import Link from "next/link";
import { isPast } from "@/lib/format";
import { ticketUrl } from "@/lib/origin";
import { ticketBrand } from "@/lib/tickets/brand";
import { TicketStub } from "./ticket-stub";

// The wallet. Every ticket carries its OWN brand mark, not the site's - RNL's
// wallet can hold a Sleep Token ticket, and when it does, the stub says ST
// and the badge in the middle of its QR says ST. A ticket looks like the show it
// admits you to, wherever you happen to be looking at it from.

type WalletTicket = {
  id: string;
  code: string;
  status: "RESERVED" | "CHECKED_IN" | "CANCELLED";
  activatedAt: Date | null;
  /** Withdrawn by the crew. See the bucketing note below - it is not "cancelled". */
  revokedAt: Date | null;
  tierName: string | null;
  priceRobux: number;
  /** Frozen at issue. Null on an unseated show. See Ticket.seatLabel. */
  seatLabel: string | null;
  event: {
    title: string;
    slug: string;
    startsAt: Date;
    venue: string | null;
    partnerId: string | null;
  };
};

export function TicketWallet({
  tickets,
  holder,
  attended,
  browseHref = "/events",
  browseLabel = "Browse events",
}: {
  tickets: WalletTicket[];
  holder: string;
  /**
   * Shows they have actually turned up to, across every org - see
   * lib/tickets/history.ts. Counted from check-ins, not from what is in this list:
   * the wallet only ever holds the tickets for ONE site's shows, and how many gigs
   * somebody has been to is not a fact about which site they are standing on.
   */
  attended?: number;
  browseHref?: string;
  browseLabel?: string;
}) {
  // ---- Three buckets, not two ----------------------------------------------
  //
  // "Past & cancelled" used to hold both, which meant a show you turned up to and a
  // ticket the crew took off you sat in the same list under the same heading. Those
  // are not the same news. A past ticket is a thing that HAPPENED; a cancelled or
  // withdrawn one is a thing that did not.
  const dead = (t: WalletTicket) => t.status === "CANCELLED";
  const upcoming = tickets.filter((t) => !dead(t) && !isPast(t.event.startsAt));
  const past = tickets.filter((t) => !dead(t) && isPast(t.event.startsAt));
  const voided = tickets.filter(dead);

  const render = (t: WalletTicket) => {
    const brand = ticketBrand(t.event.partnerId);
    const sealed = t.status === "CANCELLED" || !t.activatedAt;
    return (
      <TicketStub
        key={t.id}
        // Sealed means sealed here too, not just on the mark. This row used to print
        // the code under a "Sealed" placeholder - see the note in ticket-stub.tsx.
        code={sealed ? null : t.code}
        eventTitle={t.event.title}
        startsAt={t.event.startsAt}
        venue={t.event.venue}
        tierName={t.tierName ?? "General Admission"}
        priceRobux={t.priceRobux}
        seatLabel={t.seatLabel}
        status={t.status}
        activated={Boolean(t.activatedAt)}
        revoked={Boolean(t.revokedAt)}
        past={isPast(t.event.startsAt)}
        brandMark={brand.mark}
        // ticketUrl takes the ticket's opaque ID, not its code - its own doc comment
        // in lib/origin.ts says so, and the detail page has always got this right.
        // This passed the CODE, so every wallet QR encoded /tickets/RN-7F3A9C: a URL
        // that 404s (the page looks up by id) and that puts the withheld code in an
        // address bar on the way there.
        qrValue={sealed ? null : ticketUrl(t.id)}
        href={`/tickets/${t.id}`}
      />
    );
  };

  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-56" />

      <div className="shell relative pt-16 sm:pt-20">
        <p className="kicker text-accent">Your account</p>
        <h1 className="display mt-5 text-5xl sm:text-6xl">My tickets</h1>
        <p className="mt-4 text-muted">
          Signed in as <span className="font-semibold text-fg">{holder}</span>.
          Join the show and you&apos;re in - the door knows your Roblox account.
        </p>
        {/* The tally that was one query away for as long as this page has existed.
            Suppressed at zero: "0 shows" is a worse greeting than silence. */}
        {attended ? (
          <p className="mt-3 text-sm text-muted">
            <span className="display tnum text-fg">{attended}</span>{" "}
            {attended === 1 ? "show" : "shows"} you&apos;ve been to so far.
          </p>
        ) : null}
      </div>

      <section className="shell py-10">
        {tickets.length === 0 ? (
          <div className="card grid place-items-center px-6 py-20 text-center">
            <p className="display text-2xl">No tickets yet</p>
            <p className="mt-2 max-w-sm text-muted">
              Reserve your spot at an upcoming show and it&apos;ll show up here.
            </p>
            <Link href={browseHref} className="btn btn-accent mt-6">
              {browseLabel}
            </Link>
          </div>
        ) : (
          <div className="space-y-12">
            <Bucket title="Upcoming" tickets={upcoming} render={render} />
            <Bucket title="Past" tickets={past} render={render} muted />
            <Bucket
              title="Cancelled & withdrawn"
              tickets={voided}
              render={render}
              muted
            />
          </div>
        )}
      </section>
    </div>
  );
}

function Bucket({
  title,
  tickets,
  render,
  muted,
}: {
  title: string;
  tickets: WalletTicket[];
  render: (t: WalletTicket) => React.ReactNode;
  muted?: boolean;
}) {
  if (!tickets.length) return null;

  return (
    <div>
      <div className="mb-5 flex items-baseline gap-3">
        <h2 className={`display text-2xl ${muted ? "text-muted" : ""}`}>
          {title}
        </h2>
        <span className="tnum text-sm text-faint">{tickets.length}</span>
      </div>
      <div className="grid gap-5">{tickets.map(render)}</div>
    </div>
  );
}

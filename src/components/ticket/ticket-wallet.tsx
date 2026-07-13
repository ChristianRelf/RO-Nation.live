import Link from "next/link";
import { isPast } from "@/lib/format";
import { ticketUrl } from "@/lib/origin";
import { ticketBrand } from "@/lib/tickets/brand";
import { TicketStub } from "./ticket-stub";

// The wallet. Every ticket carries its OWN brand mark, not the site's — RNL's
// wallet can hold a Sleep Token RO ticket, and when it does, the stub says ST
// and the badge in the middle of its QR says ST. A ticket looks like the show it
// admits you to, wherever you happen to be looking at it from.

type WalletTicket = {
  id: string;
  code: string;
  status: "RESERVED" | "CHECKED_IN" | "CANCELLED";
  activatedAt: Date | null;
  tierName: string | null;
  priceRobux: number;
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
  browseHref = "/events",
  browseLabel = "Browse events",
}: {
  tickets: WalletTicket[];
  holder: string;
  browseHref?: string;
  browseLabel?: string;
}) {
  const upcoming = tickets.filter(
    (t) => t.status !== "CANCELLED" && !isPast(t.event.startsAt),
  );
  const rest = tickets.filter(
    (t) => t.status === "CANCELLED" || isPast(t.event.startsAt),
  );

  const render = (t: WalletTicket) => {
    const brand = ticketBrand(t.event.partnerId);
    const sealed = t.status === "CANCELLED" || !t.activatedAt;
    return (
      <TicketStub
        key={t.id}
        code={t.code}
        eventTitle={t.event.title}
        startsAt={t.event.startsAt}
        venue={t.event.venue}
        tierName={t.tierName ?? "General Admission"}
        priceRobux={t.priceRobux}
        status={t.status}
        activated={Boolean(t.activatedAt)}
        brandMark={brand.mark}
        qrValue={sealed ? null : ticketUrl(t.code)}
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
          Open a ticket to activate it and reveal the QR you show at the door.
        </p>
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
            {upcoming.length ? (
              <div>
                <div className="mb-5 flex items-baseline gap-3">
                  <h2 className="display text-2xl">Upcoming</h2>
                  <span className="tnum text-sm text-faint">
                    {upcoming.length}
                  </span>
                </div>
                <div className="grid gap-5">{upcoming.map(render)}</div>
              </div>
            ) : null}

            {rest.length ? (
              <div>
                <div className="mb-5 flex items-baseline gap-3">
                  <h2 className="display text-2xl text-muted">
                    Past &amp; cancelled
                  </h2>
                  <span className="tnum text-sm text-faint">{rest.length}</span>
                </div>
                <div className="grid gap-5">{rest.map(render)}</div>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

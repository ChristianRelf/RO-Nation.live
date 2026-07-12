import Link from "next/link";
import { notFound } from "next/navigation";
import { partnerBySlug } from "@/lib/partners/registry";
import {
  getFeaturedEvent,
  getPastEvents,
  getUpcomingEvents,
  type EventWithCount,
} from "@/lib/queries";
import { dateBlock, formatDate, formatTime, relativeDays } from "@/lib/format";
import { StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

// Sleep Token RO's home page.
//
// The brand has no logo or key art yet, so the identity is carried entirely by
// type, space and grain: a big quiet wordmark, a lot of black, one line of gold.
// That is a decision, not a placeholder — it reads as intentional now, and it
// takes real artwork later without a redesign (drop it into the hero and delete
// the hairline grid).
//
// It is also, deliberately, not a copy of anyone's site. The atmosphere is a
// genre; the specific design of the band's own pages is theirs. See the note in
// styles/brands/sleeptokenro.css.

export default async function PartnerHome({
  params,
}: {
  params: { slug: string };
}) {
  const partner = partnerBySlug(params.slug);
  if (!partner) notFound();

  const [featured, upcoming, past] = await Promise.all([
    getFeaturedEvent(partner.slug),
    getUpcomingEvents(partner.slug, 6),
    getPastEvents(partner.slug, 4),
  ]);

  const rest = upcoming.filter((e) => e.id !== featured?.id);
  const attended = past.reduce((n, e) => n + e.ticketsCount, 0);

  return (
    <div>
      {/* ---- Hero ---------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="hairline-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-64" />
        {/* A slow pool of light behind the wordmark, drawn in CSS — no image. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[60vh] w-[60vh] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.07] blur-3xl"
          style={{
            background: "radial-gradient(circle, var(--accent), transparent 65%)",
          }}
        />

        <div className="shell relative flex min-h-[78vh] flex-col items-center justify-center py-24 text-center">
          <p className="fade-in-1 kicker text-accent">{partner.tagline}</p>

          <h1 className="fade-in-2 display mt-8 text-[clamp(3rem,11vw,9rem)] font-light leading-[0.9]">
            Sleep Token
            <span className="mt-2 block text-accent">RO</span>
          </h1>

          <p className="fade-in-3 mt-10 max-w-md text-balance leading-relaxed text-muted">
            Tribute shows staged inside Roblox. Full production, a live crowd,
            and a free ticket tied to your account.
          </p>

          <div className="fade-in-3 mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/events" className="btn btn-accent">
              {featured ? "Get a ticket" : "See the shows"}
            </Link>
            <Link href="/tickets" className="btn btn-ghost">
              My tickets
            </Link>
          </div>
        </div>
      </section>

      {/* ---- The next show ------------------------------------------- */}
      <section className="shell py-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="kicker text-accent">Next</p>
            <h2 className="display mt-3 text-4xl sm:text-5xl">The next show</h2>
          </div>
          <Link
            href="/events"
            className="hidden text-sm font-semibold text-muted transition-colors hover:text-fg sm:block"
          >
            All shows →
          </Link>
        </div>

        {featured ? (
          <FeaturedShow event={featured} />
        ) : (
          <div className="card grid place-items-center px-6 py-20 text-center">
            <p className="display text-3xl">Nothing announced</p>
            <p className="mt-3 max-w-sm text-muted">
              The next show hasn&apos;t been announced yet. Check back — tickets
              are free, and they go fast.
            </p>
          </div>
        )}
      </section>

      {/* ---- More shows ---------------------------------------------- */}
      {rest.length ? (
        <section className="shell pb-24">
          <div className="mb-8 flex items-center gap-3 border-t border-line pt-10">
            <h2 className="display text-3xl">Also coming</h2>
            <span className="pill">{rest.length}</span>
          </div>

          <ul className="divide-y divide-line border-y border-line">
            {rest.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/events/${event.slug}`}
                  className="group flex flex-wrap items-center gap-x-6 gap-y-2 px-2 py-6 transition-colors hover:bg-surface"
                >
                  <span className="tnum w-32 shrink-0 text-sm text-faint">
                    {formatDate(event.startsAt)}
                  </span>
                  <span className="display min-w-0 flex-1 text-2xl transition-colors group-hover:text-accent">
                    {event.title}
                  </span>
                  <span className="text-sm text-muted">
                    {event.venue ?? "Venue TBA"}
                  </span>
                  <span className="text-sm text-faint transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---- Previously ---------------------------------------------- */}
      {/* The archive. Numbers, not photographs: there is no key art or show
          photography yet, and a grid of grey rectangles pretending to be a
          gallery reads worse than an honest record of who turned up. When the
          shots exist, they drop into these cards above the date line. */}
      {past.length ? (
        <section className="border-y border-line bg-elev">
          <div className="shell py-20">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="kicker text-accent">Previously</p>
                <h2 className="display mt-3 text-4xl sm:text-5xl">
                  Shows we&apos;ve staged
                </h2>
              </div>
              {attended > 0 ? (
                <p className="text-sm text-muted">
                  <span className="tnum font-semibold text-fg">{attended}</span>{" "}
                  tickets honoured at the door
                </p>
              ) : null}
            </div>

            <ul className="grid gap-px border border-line bg-line sm:grid-cols-2">
              {past.map((event) => (
                <li key={event.id} className="bg-bg p-8">
                  <p className="tnum text-xs font-semibold tracking-kicker text-faint">
                    {formatDate(event.startsAt)}
                  </p>
                  <h3 className="display mt-3 text-2xl">{event.title}</h3>
                  {event.tagline ? (
                    <p className="mt-2 text-sm text-muted">{event.tagline}</p>
                  ) : null}
                  <p className="mt-5 border-t border-line pt-4 text-sm text-faint">
                    {event.venue ?? "Venue TBA"}
                    {event.ticketsCount > 0 ? (
                      <>
                        {" · "}
                        <span className="tnum text-muted">
                          {event.ticketsCount}
                        </span>{" "}
                        in the room
                      </>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ---- What this is -------------------------------------------- */}
      <section className="shell pb-24">
        <div className="panel-paper p-10 sm:p-14">
          <p className="kicker !text-paper-ink/60">About</p>
          <h2 className="display mt-4 max-w-2xl text-4xl leading-tight text-paper-ink sm:text-5xl">
            A fan project, staged properly.
          </h2>
          <p className="mt-6 max-w-2xl leading-relaxed text-paper-ink/75">
            Sleep Token RO is a Roblox event series run by fans — tribute shows,
            built and performed inside the platform, produced with the crew at
            RO. Nation LIVE. Tickets are free and tied to your Roblox account, so
            the floor stays fair and the door moves fast.
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-paper-ink/60">
            We&apos;re not the band, and we don&apos;t pretend to be. No official
            music, artwork or branding is used here — this is a community putting
            on a show for people who love the same records we do.
          </p>
        </div>
      </section>

      {/* ---- Questions ------------------------------------------------ */}
      <section className="shell pb-24">
        <div className="mb-8 border-t border-line pt-10">
          <p className="kicker text-accent">Questions</p>
          <h2 className="display mt-3 text-4xl sm:text-5xl">Before you come</h2>
        </div>

        <div className="max-w-3xl space-y-3">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="card group p-0 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold text-fg">
                {f.q}
                <span className="text-accent transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="px-5 pb-5 leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

/**
 * The questions the door actually gets asked.
 *
 * Two of these are load-bearing rather than decorative. The VIP answer must not
 * imply anything is on sale — paid tiers render locked while ROBUX_TICKETS_ENABLED
 * is off, and a page that promises otherwise sells a ticket the site cannot
 * honour. The last answer restates the disclaimer in the visitor's own words;
 * the footer carries the formal one, and neither is a substitute for the other.
 */
const FAQS = [
  {
    q: "What does a ticket cost?",
    a: "Nothing. Every ticket you can reserve today is free — one per Roblox account, tied to that account, and checked at the door.",
  },
  {
    q: "How do I get in on the night?",
    a: "Reserve a ticket, then open it from My tickets when doors open. It carries a code beginning ST-, and the crew redeems it as you come through — no code, no entry, so reserve before you travel.",
  },
  {
    q: "Some shows list a VIP tier. Can I buy one?",
    a: "Not yet. VIP tiers are designed and priced, but paid ticketing is switched off across the platform, so they render locked and cannot be reserved. Nothing is charged to anybody today.",
  },
  {
    q: "The show is sold out. Will more tickets appear?",
    a: "The cap is the room, so a sold-out show usually stays sold out. Tickets do come back when people release them, and the next show is normally announced within a few weeks.",
  },
  {
    q: "Are you the band?",
    a: "No — and we don't pretend to be. This is a fan-run Roblox event series, produced with RO. Nation LIVE. It isn't affiliated with, endorsed by, or connected to Sleep Token, and no official music, artwork or branding is used.",
  },
];

function FeaturedShow({ event }: { event: EventWithCount }) {
  const { day, month } = dateBlock(event.startsAt);
  const remaining =
    event.capacity > 0 ? Math.max(0, event.capacity - event.ticketsCount) : null;
  const soldOut = remaining !== null && remaining <= 0;

  return (
    <div className="card grid overflow-hidden md:grid-cols-[auto_1fr_auto]">
      {/* Date block */}
      <div className="flex items-center justify-center border-b border-line px-10 py-8 md:border-b-0 md:border-r">
        <div className="text-center leading-none">
          <p className="display text-6xl">{day}</p>
          <p className="mt-2 text-xs font-bold tracking-kicker text-accent">
            {month}
          </p>
        </div>
      </div>

      {/* Detail */}
      <div className="min-w-0 border-b border-line p-8 md:border-b-0 md:border-r">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={soldOut ? "soldout" : "upcoming"}>
            {soldOut ? "Sold out" : relativeDays(event.startsAt)}
          </StatusBadge>
          <span className="pill">{event.category}</span>
        </div>

        <h3 className="display mt-4 text-4xl">{event.title}</h3>
        {event.tagline ? <p className="mt-3 text-muted">{event.tagline}</p> : null}

        <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 text-sm">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-faint">
              Doors
            </dt>
            <dd className="mt-1 font-medium">
              {formatTime(event.doorsAt ?? event.startsAt)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-faint">
              Venue
            </dt>
            <dd className="mt-1 font-medium">{event.venue ?? "TBA"}</dd>
          </div>
          {remaining !== null ? (
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                Remaining
              </dt>
              <dd className="tnum mt-1 font-medium">{remaining}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      {/* CTA */}
      <div className="flex items-center justify-center p-8">
        {soldOut ? (
          <span className="btn w-full cursor-not-allowed border border-line text-muted md:w-auto">
            Sold out
          </span>
        ) : (
          <Link
            href={`/events/${event.slug}`}
            className="btn btn-accent w-full md:w-auto"
          >
            Reserve free ticket
          </Link>
        )}
      </div>
    </div>
  );
}

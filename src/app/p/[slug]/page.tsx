import Link from "next/link";
import { notFound } from "next/navigation";
import { partnerBySlug, partnerHasFeature } from "@/lib/partners/registry";
import { getPartnerContent } from "@/lib/partners/content";
import {
  getFeaturedEvent,
  getPastEvents,
  getUpcomingEvents,
  type EventWithCount,
} from "@/lib/queries";
import { dateBlock, formatDate, formatTime, relativeDays } from "@/lib/format";
import { StatusBadge } from "@/components/ui";
import { HeroCrest, PartnerDisclaimer, PartnerMark } from "@/components/partner/emblem";
import { toLines } from "@/lib/utils";

export const dynamic = "force-dynamic";

// A partner's home page.
//
// The COPY is theirs: hero, about panel and FAQ all come from PartnerContent,
// which they edit in their studio. Every field falls back - to the registry's
// tagline and description, or to the wording below - so a partner who has never
// opened the editor still gets a finished page.
//
// The SHAPE is the same for every partner, and it is built around one idea: an
// enormous dim crest, a mark, a name, and then a great deal of black. It works
// with artwork (Sleep Token) and without it (the pool of light and the
// hairline grid carry a partner who has none), so this is not a Sleep Token page
// with the others squeezed into it - it is a page that gets *more* atmospheric
// the more artwork you give it.
//
// The disclaimer is rendered directly under the hero, not only in the footer.
// That is deliberate and it is the one thing on this page not to quietly drop:
// this site carries a real band's real marks, so the sentence that says it is not
// their site has to be somewhere a visitor actually looks. See emblem.tsx.

export default async function PartnerHome({
  params,
}: {
  params: { slug: string };
}) {
  const partner = partnerBySlug(params.slug);
  if (!partner) notFound();

  const content = await getPartnerContent(partner);

  // A partner without the events feature still has a homepage - it just has no
  // shows on it. So the event queries are skipped rather than the page refused.
  const hasEvents = partnerHasFeature(partner, "events");

  const [featured, upcoming, past] = await Promise.all([
    hasEvents ? getFeaturedEvent(partner.slug) : null,
    hasEvents ? getUpcomingEvents(partner.slug, 6) : [],
    hasEvents ? getPastEvents(partner.slug, 4) : [],
  ]);

  const rest = upcoming.filter((e) => e.id !== featured?.id);
  const attended = past.reduce((n, e) => n + e.ticketsCount, 0);

  // What goes behind the hero - or nothing, if a full-site backdrop is already
  // carrying the atmosphere. Stacking a hero crest on top of a fixed backdrop is
  // two enormous emblems fighting on one screen, so the bigger gesture wins and
  // the hero falls back to type, space and the mark. See Partner.backdropUrl.
  //
  // The studio's own heroImageUrl beats both, always: it is the one an actual
  // human set, for this run of shows, and it should not be silently ignored
  // because of something in the registry. (Rendering it at all also closes a live
  // gap - it has been editable and uploadable since the content editor shipped,
  // and nothing has ever put it on a page.)
  const crest =
    content.heroImageUrl ?? (partner.backdropUrl ? null : partner.crestUrl ?? null);

  return (
    <div>
      {/* ---- Hero ---------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-line">
        {/* Three cases, and the third is the reason this isn't a ternary:
              crest      → the emblem, dim, behind the type.
              backdrop   → NOTHING here. The fixed layer behind the whole site is
                           already doing this job, and laying a grid and a glow on
                           top of it just muddies the artwork it is showing.
              neither    → type, space and a pool of light. What every partner had
                           before this page learned to hold a picture, and still
                           the right answer for a brand with no artwork. */}
        {crest ? (
          <HeroCrest src={crest} />
        ) : partner.backdropUrl ? null : (
          <>
            <div className="hairline-grid pointer-events-none absolute inset-0 opacity-40" />
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-[60vh] w-[60vh] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.07] blur-3xl"
              style={{
                background: "radial-gradient(circle, var(--accent), transparent 65%)",
              }}
            />
          </>
        )}

        <div className="shell relative flex min-h-[88vh] flex-col items-center justify-center py-28 text-center">
          {/* The mark sits above the name, small. It is an emblem, not a banner:
              blown up it competes with the crest it is standing on. */}
          <div className="fade-in-1 flex justify-center">
            <PartnerMark partner={partner} size={72} className="max-h-16 opacity-90" />
          </div>

          <p className="fade-in-1 kicker mt-8 text-accent">{content.heroKicker}</p>

          <h1 className="fade-in-2 display mt-6 text-[clamp(2.5rem,9vw,7.5rem)] leading-[0.95]">
            {content.heroTitle ?? <Wordmark name={partner.name} />}
          </h1>

          {/* A hairline under the name - the inlay, closing the lockup. */}
          <div
            aria-hidden
            className="fade-in-2 mt-10 h-px w-24 bg-accent/50"
          />

          <p className="fade-in-3 mt-10 max-w-md text-balance leading-relaxed text-muted">
            {content.heroSubtitle}
          </p>

          {hasEvents ? (
            <div className="fade-in-3 mt-12 flex flex-wrap items-center justify-center gap-3">
              <Link href="/events" className="btn btn-accent">
                {featured ? "Get a ticket" : "See the shows"}
              </Link>
              <Link href="/tickets" className="btn btn-ghost">
                My tickets
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      {/* ---- Whose site this is -------------------------------------- */}
      {/* Directly under the hero, in the flow of the page, at body size.
          A visitor who has just seen the band's crest fill their screen is
          precisely the visitor this sentence is for, and the footer is too late
          to tell them. Do not move it, shrink it, or fold it away. */}
      {partner.disclaimer ? (
        <section className="border-b border-line bg-elev">
          <div className="shell py-6">
            <PartnerDisclaimer partner={partner} className="mx-auto text-center" />
          </div>
        </section>
      ) : null}

      {/* ---- The next show ------------------------------------------- */}
      {hasEvents ? (
        <section className="shell py-24">
          <div className="mb-10 flex items-end justify-between gap-4">
            <div>
              <p className="kicker text-accent">Next</p>
              <h2 className="display mt-4 text-4xl sm:text-5xl">The next show</h2>
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
            <div className="card grid place-items-center px-6 py-24 text-center">
              <p className="display text-3xl">Nothing announced</p>
              <p className="mt-4 max-w-sm text-muted">
                The next show hasn&apos;t been announced yet. Check back - tickets
                are free, and they go fast.
              </p>
            </div>
          )}
        </section>
      ) : null}

      {/* ---- More shows ---------------------------------------------- */}
      {rest.length ? (
        <section className="shell pb-24">
          <div className="mb-8 flex items-center gap-3 border-t border-line pt-12">
            <h2 className="display text-3xl">Also coming</h2>
            <span className="pill">{rest.length}</span>
          </div>

          <ul className="divide-y divide-line border-y border-line">
            {rest.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/events/${event.slug}`}
                  className="group flex flex-wrap items-center gap-x-6 gap-y-2 px-2 py-7 transition-colors hover:bg-surface"
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
      {past.length ? (
        <section className="border-y border-line bg-elev">
          <div className="shell py-24">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="kicker text-accent">Previously</p>
                <h2 className="display mt-4 text-4xl sm:text-5xl">
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
                  <h3 className="display mt-4 text-2xl">{event.title}</h3>
                  {event.tagline ? (
                    <p className="mt-2 text-sm text-muted">{event.tagline}</p>
                  ) : null}
                  <p className="mt-6 border-t border-line pt-4 text-sm text-faint">
                    {event.venue ?? "Venue TBA"}
                    {event.ticketsCount > 0 ? (
                      <>
                        {" · "}
                        <span className="tnum text-muted">{event.ticketsCount}</span>{" "}
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
      {/* Dropped entirely when the partner has written no body - an empty paper
          panel with a heading and nothing under it looks broken, not minimal. */}
      {content.aboutBody ? (
        <section className="shell py-24">
          <div className="panel-paper p-10 sm:p-14">
            <p className="kicker !text-paper-ink/60">{content.aboutKicker}</p>
            {content.aboutTitle ? (
              <h2 className="display mt-5 max-w-2xl text-4xl leading-tight text-paper-ink sm:text-5xl">
                {content.aboutTitle}
              </h2>
            ) : null}
            <div className="mt-6 max-w-2xl space-y-4 leading-relaxed text-paper-ink/75">
              {toLines(content.aboutBody).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
            {content.aboutNote ? (
              <div className="mt-4 max-w-2xl space-y-3 text-sm leading-relaxed text-paper-ink/60">
                {toLines(content.aboutNote).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ---- Questions ------------------------------------------------ */}
      {content.faq.length ? (
        <section className="shell pb-28">
          <div className="mb-10 border-t border-line pt-12">
            <p className="kicker text-accent">Questions</p>
            <h2 className="display mt-4 text-4xl sm:text-5xl">Before you come</h2>
          </div>

          <div className="max-w-3xl space-y-3">
            {content.faq.map((f, i) => (
              <details
                key={i}
                className="card group p-0 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold text-fg">
                  {f.q}
                  <span className="text-accent transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="whitespace-pre-line px-5 pb-5 leading-relaxed text-muted">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/**
 * The partner's name as the hero wordmark: last word on its own line, in the
 * accent. "Sleep Token" reads as "Sleep Token" over "RO" - which keeps the
 * fan project's own initials visibly attached to the name rather than letting the
 * page render as the band's name alone.
 */
function Wordmark({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return <>{name}</>;

  const last = parts.pop();
  return (
    <>
      {parts.join(" ")}
      <span className="mt-3 block text-accent">{last}</span>
    </>
  );
}

function FeaturedShow({ event }: { event: EventWithCount }) {
  const { day, month } = dateBlock(event.startsAt);
  const remaining =
    event.capacity > 0 ? Math.max(0, event.capacity - event.ticketsCount) : null;
  const soldOut = remaining !== null && remaining <= 0;

  return (
    <div className="card grid overflow-hidden md:grid-cols-[auto_1fr_auto]">
      {/* Date block */}
      <div className="flex items-center justify-center border-b border-line px-12 py-10 md:border-b-0 md:border-r">
        <div className="text-center leading-none">
          <p className="display text-6xl">{day}</p>
          <p className="mt-3 text-xs font-bold tracking-kicker text-accent">
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

        <h3 className="display mt-5 text-4xl">{event.title}</h3>
        {event.tagline ? <p className="mt-3 text-muted">{event.tagline}</p> : null}

        <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-3 text-sm">
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

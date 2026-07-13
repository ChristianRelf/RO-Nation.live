import Link from "next/link";
import {
  getFeaturedEvent,
  getUpcomingEvents,
  getPastEvents,
  getOpenCareers,
  getPublishedPosts,
} from "@/lib/queries";
import { Countdown } from "@/components/countdown";
import { EventCard } from "@/components/event-card";
import { EventTicker } from "@/components/event-ticker";
import { QuoteMarquee, type Quote } from "@/components/quote-marquee";
import { Reveal } from "@/components/reveal";
import { Kicker, SectionHeading } from "@/components/ui";
import { formatDate, formatTime } from "@/lib/format";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

const stats = [
  { value: "40+", label: "Shows produced" },
  { value: "120K+", label: "Seats filled" },
  { value: "60+", label: "Crew members" },
  { value: "4.9/5", label: "Attendee rating" },
];

const pillars = [
  {
    step: "01",
    title: "We produce",
    body: "Custom-built venues, live production, hosts and a full run-of-show. Every event is designed from the blockout up — not a template.",
  },
  {
    step: "02",
    title: "You reserve",
    body: "Sign in with Roblox and lock your spot in seconds. Every ticket carries a unique code tied to your account.",
  },
  {
    step: "03",
    title: "We verify in-game",
    body: "Your ticket is checked at the door inside the experience through our API — no screenshots, no fakes, no queue-jumping.",
  },
];

// Crowd copy. Swap these for real quotes as they come in — the layout takes any
// number of them and loops until the strip is full.
const quotes: Quote[] = [
  {
    body: "Genuinely forgot I was in Roblox for a second. The lighting on that final drop was unreal.",
    author: "vyn",
    meta: "Front row",
  },
  {
    body: "Doors opened, scanned straight through, no queue, no drama. First time that's ever happened at a Roblox show.",
    author: "kade_",
    meta: "Ticket holder",
  },
  {
    body: "The stage build alone was worth logging in for. You can tell nobody phoned this in.",
    author: "mira",
    meta: "Showcase night",
  },
  {
    body: "Brought six friends, all six got in free, all six stayed till the lights came up.",
    author: "TSUKI",
    meta: "Regular",
  },
  {
    body: "Best-run event I've been to on the platform. It felt like an actual gig.",
    author: "orbit",
    meta: "Tournament finals",
  },
];

const faqs = [
  {
    q: "Are tickets actually free?",
    a: "Every ticket is free. You just sign in with Roblox so we can verify you at the door — no payment, no resale, ever.",
  },
  {
    q: "What do I need to get in?",
    a: "A Roblox account and a reserved ticket. It lives on your account, so there's nothing to screenshot or hand over.",
  },
  {
    q: "What happens if a show sells out?",
    a: "Capacity is real and it's enforced at the door. When a show fills up, that's it — which is why the Discord gets the drop first.",
  },
  {
    q: "Can I run an event with you?",
    a: "Yes. We produce, build and ticket shows for other groups and creators. Get in touch and we'll talk it through.",
  },
];

export default async function HomePage() {
  const [featured, upcoming, past, careers, posts] = await Promise.all([
    // null = RNL's own events. A partner's never appear on this site.
    getFeaturedEvent(null),
    getUpcomingEvents(null, 7),
    getPastEvents(null, 4),
    getOpenCareers(null),
    getPublishedPosts(null, 3),
  ]);

  const grid = upcoming.filter((e) => e.id !== featured?.id).slice(0, 6);
  const tickerItems = upcoming.map(
    (e) => `${e.title} — ${formatDate(e.startsAt).toUpperCase()}`,
  );

  // Urgency, but only when it's true: a capacity of 0 means unlimited, and a bar
  // drawn against no ceiling would be theatre.
  const claimed =
    featured && featured.capacity > 0
      ? Math.min(
          100,
          Math.round((featured.ticketsCount / featured.capacity) * 100),
        )
      : null;
  const remaining =
    featured && featured.capacity > 0
      ? Math.max(0, featured.capacity - featured.ticketsCount)
      : null;

  const attended = past.reduce((sum, e) => sum + e.ticketsCount, 0);

  return (
    <>
      {/* ---------------- HERO ---------------- */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="hairline-grid pointer-events-none absolute inset-0 opacity-[0.35] [mask-image:linear-gradient(to_bottom,#000,transparent_70%)]" />
        <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-80" />

        {/* meta rail */}
        <div className="relative border-b border-line">
          <div className="shell flex items-center justify-between gap-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            <span>Roblox Event Management</span>
            <span className="hidden md:block">
              Shows · Showcases · Tournaments
            </span>
            <span className="flex items-center gap-2 text-fg">
              <span className="h-1.5 w-1.5 bg-accent" />
              Live since 2024
            </span>
          </div>
        </div>

        <div className="shell relative grid gap-12 pb-14 pt-14 lg:grid-cols-[1.1fr_0.9fr] lg:pb-20 lg:pt-20">
          <div className="flex flex-col justify-center">
            <Reveal>
              <Kicker>Roblox event management</Kicker>
            </Reveal>
            <Reveal delay={60}>
              <h1 className="display mt-6 text-[15.5vw] leading-[0.84] sm:text-7xl md:text-8xl lg:text-[104px]">
                Live events,
                <br />
                built to
                <br />
                <span className="mt-1 inline-block bg-accent px-2.5 text-accent-ink">
                  sell out.
                </span>
              </h1>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-8 max-w-lg text-lg leading-relaxed text-muted">
                {site.shortName} LIVE produces the shows, showcases and
                tournaments the community actually shows up for — from the first
                block placed in Studio to the last drop on the floor.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link href="/events" className="btn btn-accent">
                  Get tickets
                </Link>
                <Link href="/careers" className="btn btn-ghost">
                  Join the crew
                </Link>
              </div>
            </Reveal>
            <Reveal delay={230}>
              <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                {[
                  "Always free",
                  "Roblox sign-in",
                  "Verified at the door",
                  "No resale",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="text-accent">✦</span>
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          {/* Featured event card */}
          {featured ? (
            <Reveal delay={140} className="flex items-center">
              <Link
                href={`/events/${featured.slug}`}
                className="group card card-hover relative flex w-full flex-col overflow-hidden"
              >
                <div className="relative aspect-[16/11] overflow-hidden border-b border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={featured.thumbnailUrl || "/placeholders/event-01.svg"}
                    alt=""
                    className="h-full w-full object-cover grayscale-[0.2] transition-all duration-700 group-hover:scale-[1.03] group-hover:grayscale-0"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-transparent" />
                  <div className="absolute left-0 top-0 border-b border-r border-fg/15 bg-bg/85 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
                    Next show
                  </div>
                  <div className="absolute inset-x-4 bottom-4">
                    <h3 className="font-display text-3xl leading-[0.9]">
                      {featured.title}
                    </h3>
                  </div>
                </div>

                <div className="border-b border-line px-4 py-4">
                  <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                    Doors in
                  </div>
                  <Countdown target={featured.startsAt.toISOString()} />
                </div>

                {claimed !== null ? (
                  <div className="border-b border-line px-4 py-3.5">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em]">
                      <span className="text-muted">
                        <span className="tnum text-fg">{claimed}%</span> claimed
                      </span>
                      <span className="tnum text-accent">
                        {remaining} seats left
                      </span>
                    </div>
                    <div className="mt-2 h-1 w-full overflow-hidden bg-fg/10">
                      <div
                        className="h-full bg-accent"
                        style={{ width: `${claimed}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="font-mono text-sm tnum text-fg">
                      {formatDate(featured.startsAt)}
                    </p>
                    <p className="text-sm text-muted">
                      {formatTime(featured.startsAt)}
                      {featured.venue ? ` · ${featured.venue}` : ""}
                    </p>
                  </div>
                  <span className="btn btn-accent !px-5 !py-2.5">Reserve →</span>
                </div>
              </Link>
            </Reveal>
          ) : (
            <div className="hidden lg:block" />
          )}
        </div>

        {/* stat strip */}
        <div className="border-t border-line">
          <div className="shell grid grid-cols-2 divide-x divide-line md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="px-2 py-6 text-center md:py-7">
                <div className="font-display text-3xl tnum text-fg md:text-4xl">
                  {s.value}
                </div>
                <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- TICKER ---------------- */}
      <EventTicker items={tickerItems} />

      {/* ---------------- UPCOMING ---------------- */}
      <section className="shell py-20 sm:py-24">
        <SectionHeading
          kicker="On the calendar"
          title={<>Upcoming events</>}
          action={{ label: "All events", href: "/events" }}
        />
        {grid.length ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {grid.map((event, i) => (
              <Reveal key={event.id} delay={i * 55}>
                <EventCard event={event} priority={i < 3} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="mt-10 card grid place-items-center px-6 py-20 text-center">
            <p className="font-display text-2xl">No shows on sale right now</p>
            <p className="mt-2 max-w-sm text-muted">
              We&apos;re cooking up the next one. Join the Discord to be first in
              line when tickets drop.
            </p>
            <a href={site.socials.discord} className="btn btn-ghost mt-6">
              Join the Discord
            </a>
          </div>
        )}
      </section>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section className="border-y border-line bg-elev">
        <div className="shell py-20 sm:py-24">
          <SectionHeading
            kicker="How it works"
            title={
              <>
                Produced. Ticketed.
                <br className="hidden sm:block" /> Verified.
              </>
            }
          />
          <div className="mt-12 grid divide-y divide-line border-y border-line md:grid-cols-3 md:divide-x md:divide-y-0">
            {pillars.map((p) => (
              <div key={p.step} className="p-7 md:px-7 md:py-9">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-5xl text-accent">
                    {p.step}
                  </span>
                  <span className="h-px flex-1 bg-line" />
                </div>
                <h3 className="mt-5 font-display text-2xl">{p.title}</h3>
                <p className="mt-3 text-muted">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- LAST TIME ---------------- */}
      {past.length ? (
        <section className="shell py-20 sm:py-24">
          <SectionHeading
            kicker="From the floor"
            title={<>You missed a good one.</>}
            action={{ label: "Past events", href: "/events" }}
          />
          <p className="mt-5 max-w-xl text-muted">
            {attended > 0 ? (
              <>
                <span className="tnum font-semibold text-fg">
                  {attended.toLocaleString("en-GB")}
                </span>{" "}
                tickets checked in across our last {past.length} shows. Here&apos;s
                what the room looked like.
              </>
            ) : (
              <>Here&apos;s what the room looked like last time out.</>
            )}
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {past.map((e, i) => (
              <Reveal key={e.id} delay={i * 55}>
                <Link
                  href={`/events/${e.slug}`}
                  className="group card card-hover relative block overflow-hidden"
                >
                  <div className="relative aspect-[4/5] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={e.thumbnailUrl || "/placeholders/event-02.svg"}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-[1.04] group-hover:grayscale-0"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
                    <div className="absolute inset-x-4 bottom-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
                        {formatDate(e.startsAt)}
                      </p>
                      <h3 className="mt-1.5 font-display text-2xl leading-[0.95]">
                        {e.title}
                      </h3>
                      {e.ticketsCount > 0 ? (
                        <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
                          <span className="tnum text-fg">
                            {e.ticketsCount.toLocaleString("en-GB")}
                          </span>{" "}
                          in the room
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---------------- CROWD ---------------- */}
      <section className="overflow-hidden border-y border-line bg-elev py-20 sm:py-24">
        <div className="shell">
          <SectionHeading kicker="Word of mouth" title="What the crowd said" />
        </div>
        <QuoteMarquee quotes={quotes} className="mt-12" />
      </section>

      {/* ---------------- DISPATCH ---------------- */}
      {posts.length ? (
        <section className="shell py-20 sm:py-24">
          <SectionHeading
            kicker="From the desk"
            title={<>Latest dispatch</>}
            action={{ label: "Read the blog", href: "/blog" }}
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {posts.map((p, i) => (
              <Reveal key={p.id} delay={i * 55}>
                <Link
                  href={`/blog/${p.slug}`}
                  className="group card card-hover flex h-full flex-col overflow-hidden"
                >
                  {p.coverUrl ? (
                    <div className="relative aspect-[16/9] overflow-hidden border-b border-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.coverUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover grayscale-[0.15] transition-all duration-500 group-hover:scale-[1.04] group-hover:grayscale-0"
                      />
                    </div>
                  ) : null}
                  <div className="flex flex-1 flex-col p-6">
                    {p.publishedAt ? (
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                        {formatDate(p.publishedAt)}
                      </span>
                    ) : null}
                    <h3 className="mt-2.5 font-display text-2xl leading-[0.95] transition-colors group-hover:text-accent">
                      {p.title}
                    </h3>
                    {p.excerpt ? (
                      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">
                        {p.excerpt}
                      </p>
                    ) : null}
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-[11px] font-bold uppercase tracking-[0.1em] text-fg">
                      Read it
                      <span className="transition-transform group-hover:translate-x-1">
                        →
                      </span>
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---------------- CAREERS CTA ---------------- */}
      <section className="shell py-20 sm:py-24">
        <div className="panel-paper relative overflow-hidden p-8 sm:p-12">
          <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-center">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/50">
                We&apos;re hiring
              </span>
              <h2 className="display mt-4 text-4xl leading-[0.9] text-black sm:text-6xl">
                Run the show with us.
              </h2>
              <p className="mt-5 max-w-xl text-black/70">
                Hosts, builders, moderators, editors — every great event is a
                team effort. If you want your name on the credits, we want to
                meet you.
              </p>
              <Link
                href="/careers"
                className="mt-7 inline-flex items-center gap-2 rounded-[3px] bg-black px-6 py-3 text-[12px] font-bold uppercase tracking-[0.09em] text-paper transition-colors hover:bg-accent hover:text-accent-ink"
              >
                See open roles{careers.length ? ` — ${careers.length}` : ""}
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {["Event Host", "Stage Builder", "Moderator", "Social Media"].map(
                (r) => (
                  <div
                    key={r}
                    className="rounded-[3px] border border-black/20 px-4 py-4 text-sm font-bold uppercase tracking-[0.06em] text-black"
                  >
                    {r}
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- QUICK ANSWERS ---------------- */}
      <section className="border-y border-line bg-elev">
        <div className="shell grid gap-12 py-20 sm:py-24 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Kicker>Before you ask</Kicker>
            <h2 className="display mt-4 text-4xl sm:text-5xl">
              Quick answers.
            </h2>
            <p className="mt-5 max-w-sm text-muted">
              The short version. The long version lives on the FAQ.
            </p>
            <Link href="/faq" className="btn btn-ghost mt-7">
              Read the FAQ
            </Link>
          </div>
          <div className="divide-y divide-line border-y border-line">
            {faqs.map((f) => (
              <details key={f.q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left font-display text-xl transition-colors hover:text-accent">
                  {f.q}
                  <span className="text-accent transition-transform duration-300 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="pb-5 pr-8 text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- FINAL CTA ---------------- */}
      <section className="relative overflow-hidden">
        <div className="hairline-grid pointer-events-none absolute inset-0 opacity-25 [mask-image:linear-gradient(to_top,#000,transparent_75%)]" />
        <div className="shell relative py-24 text-center sm:py-32">
          <Kicker className="justify-center">Don&apos;t miss the drop</Kicker>
          <h2 className="display mx-auto mt-6 max-w-4xl text-5xl leading-[0.88] sm:text-7xl md:text-8xl">
            The next one
            <br />
            starts{" "}
            <span className="inline-block bg-accent px-2.5 text-accent-ink">
              without you.
            </span>
          </h2>
          <p className="mx-auto mt-7 max-w-md text-lg text-muted">
            Tickets are free, capacity isn&apos;t. The Discord hears about every
            show first — everyone else finds out when it&apos;s already full.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/events" className="btn btn-accent">
              Get tickets
            </Link>
            <a
              href={site.socials.discord}
              className="btn btn-ghost"
              target="_blank"
              rel="noreferrer"
            >
              Join the Discord
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

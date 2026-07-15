import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSiteStats, statTiles } from "@/lib/stats";
import { getUpcomingEvents, getFeaturedEvent } from "@/lib/queries";
import { Countdown } from "@/components/countdown";
import { EventTicker } from "@/components/event-ticker";
import { QuoteMarquee } from "@/components/quote-marquee";
import { Reveal } from "@/components/reveal";
import { Kicker, SectionHeading } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { site } from "@/lib/site";
import { cn, robloxProfileUrl } from "@/lib/utils";

// Dynamic, because the exciting parts are REAL: the stat band, the crew faces, the crowd's
// own words and the countdown to the next show are all read from the database on request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About",
  description:
    "RO. Nation LIVE is a Roblox event management group producing shows, showcases and tournaments - with real ticketing and in-experience door verification.",
  alternates: { canonical: "/about" },
};

// ---- The rule this page is built on ---------------------------------------
//
// NO FAKE DATA. Not one number, name or quote on this page is typed - the stat band is
// counted (lib/stats.ts), the crew are Roblox accounts (TeamMember), the quotes were said
// by real, signed-in people (Testimonial, published only), and the countdown is a real
// show's real start time. Anything that cannot be counted is ABSENT, exactly as on the
// homepage - see the long note there and in lib/stats.ts. What is NOT data - what we do,
// how ticketing works, the house rules - is the org describing itself, and it stays.
//
// The excitement comes from motion and type and real facts, never from a rounded-up one.

const services = [
  {
    title: "Event production",
    body: "Concept, run-of-show, hosting and live direction. We treat every event like a real production, not a hangout.",
  },
  {
    title: "Venue & stage building",
    body: "Custom venues built in Studio and optimised for big servers - stages, lighting rigs and interactive set pieces.",
  },
  {
    title: "Ticketing & entry",
    body: "Free, account-tied tickets with unique codes, capacity control, and live check-in verified inside the experience.",
  },
  {
    title: "Talent & casting",
    body: "Hosts, performers, DJs and commentators from our roster - vetted, briefed and show-ready.",
  },
];

const values = [
  {
    k: "Show up prepared",
    v: "Sound-checked, rehearsed, and on time. The crowd can tell the difference.",
  },
  {
    k: "Build it properly",
    v: "Performance and polish over shortcuts. If it lags, it isn't finished.",
  },
  {
    k: "Respect the crowd",
    v: "Safe, welcoming events. Moderation is a feature, not an afterthought.",
  },
];

const ticketSteps = [
  {
    n: "01",
    t: "Reserve online",
    d: "Sign in with Roblox and reserve a free ticket. It's tied to your account and given a unique code.",
  },
  {
    n: "02",
    t: "Show up in-experience",
    d: "Join the event experience on Roblox when doors open. Your ticket lives in your account - nothing to screenshot.",
  },
  {
    n: "03",
    t: "Verified at the door",
    d: "Our entry system checks your ticket against our API in real time. Valid tickets get waved in; everyone else waits at the gate.",
  },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function AboutPage() {
  const [stats, upcoming, featured, crew, quotes] = await Promise.all([
    getSiteStats(),
    getUpcomingEvents(null, 8),
    getFeaturedEvent(null),
    // The real crew, in the order /team shows them. No take: the count below is the whole
    // crew, not a page of it, so it can never claim more faces than it shows.
    prisma.teamMember.findMany({
      where: { visible: true },
      orderBy: [{ department: "asc" }, { order: "asc" }, { displayName: "asc" }],
    }),
    // Published only - the column defaults to false, so a quote is here because somebody
    // read it and decided, never because somebody typed it. Same query as the homepage.
    prisma.testimonial.findMany({
      where: { published: true },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      take: 12,
    }),
  ]);

  const tiles = statTiles(stats);
  const tickerItems = upcoming.map(
    (e) => `${e.title} - ${formatDate(e.startsAt).toUpperCase()}`,
  );
  const faces = crew.slice(0, 7);

  return (
    <div>
      {/* ---------------- HERO ---------------- */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="hairline-grid pointer-events-none absolute inset-0 opacity-[0.35] [mask-image:linear-gradient(to_bottom,#000,transparent_72%)]" />
        <div className="accent-glow pointer-events-none absolute inset-x-0 -top-10 h-80" />

        {/* meta rail - the same signal the homepage flies, so the story is one story */}
        <div className="relative border-b border-line">
          <div className="shell flex items-center justify-between gap-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            <span>Who we are</span>
            <span className="hidden md:block">Produced · Ticketed · Verified</span>
            <span className="flex items-center gap-2 text-fg">
              <span className="h-1.5 w-1.5 bg-accent" />
              Est. 2023 :: 2026 Revival
            </span>
          </div>
        </div>

        <div className="shell relative py-16 sm:py-20 lg:py-24">
          <Reveal>
            <Kicker>Roblox event management</Kicker>
          </Reveal>
          <Reveal delay={60}>
            <h1 className="display mt-6 max-w-5xl text-[13.5vw] leading-[0.86] sm:text-7xl md:text-8xl lg:text-[112px]">
              We build the
              <br />
              nights people{" "}
              <span className="inline-block bg-accent px-2.5 text-accent-ink">
                log in for.
              </span>
            </h1>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted">
              {site.name} is a Roblox event management group. We produce live shows,
              showcases, tournaments and festivals - handling everything from the first
              block placed in Studio to verifying tickets at the door. What started as a few
              friends throwing shows is now a full crew of builders, hosts, editors and
              moderators.
            </p>
          </Reveal>

          <Reveal delay={180}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/events" className="btn btn-accent">
                See the shows
              </Link>
              <Link href="/careers" className="btn btn-ghost">
                Join the crew
              </Link>
            </div>
          </Reveal>

          {/* Next show, live. Only when there IS one - a countdown to nothing is theatre. */}
          {featured ? (
            <Reveal delay={230}>
              <Link
                href={`/events/${featured.slug}`}
                className="group mt-10 inline-flex flex-wrap items-center gap-x-5 gap-y-2 rounded-brand border border-line bg-elev px-5 py-3 transition-colors hover:border-line-strong"
              >
                <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping bg-accent opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 bg-accent" />
                  </span>
                  Next show
                </span>
                <span className="font-display text-lg leading-none">{featured.title}</span>
                <span className="hidden h-4 w-px bg-line sm:block" />
                <span className="hidden sm:block">
                  <Countdown target={featured.startsAt.toISOString()} />
                </span>
                <span className="text-sm font-semibold text-fg transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </Reveal>
          ) : null}
        </div>

        {/* ---- REAL stat band ----
            Every number is COUNTED (lib/stats.ts): shows we actually ran, people who
            actually came through a door, shirts Roblox says were bought, the group's size.
            Zeros are dropped, and below two survivors the whole band is dropped - one tile
            is not a band. On a young site that means it is simply not here yet, which is a
            true thing to say. It is never padded to look fuller. */}
        {tiles.length >= 2 ? (
          <div className="relative border-t border-line">
            <div className="shell flex items-center gap-2 pt-6 text-[10px] font-bold uppercase tracking-[0.16em] text-faint">
              <span className="h-px w-6 bg-accent" />
              By the numbers - counted, never rounded up
            </div>
            <div
              className={cn(
                "shell grid grid-cols-2 divide-x divide-line pb-2",
                tiles.length >= 4 ? "md:grid-cols-4" : "md:grid-cols-3",
              )}
            >
              {tiles.map((t, i) => (
                <Reveal key={t.label} delay={i * 60}>
                  <div className="px-2 py-6 text-center md:py-7">
                    <div className="font-display text-3xl tnum text-fg md:text-5xl">
                      {t.value}
                    </div>
                    <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                      {t.label}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* ---------------- TICKER ---------------- */}
      <EventTicker items={tickerItems} />

      {/* ---------------- WHAT WE DO ---------------- */}
      <section className="border-b border-line bg-elev">
        <div className="shell py-20 sm:py-24">
          <SectionHeading
            kicker="What we do"
            title={<>Full-service events</>}
            action={{ label: "See the shows", href: "/events" }}
          />
          <div className="mt-12 grid divide-y divide-line border-y border-line sm:grid-cols-2 sm:divide-x">
            {services.map((s, i) => (
              <Reveal key={s.title} delay={i * 70}>
                <div className="group relative h-full overflow-hidden p-8 transition-colors hover:bg-bg">
                  <span className="font-mono text-xs font-bold tracking-[0.2em] text-accent">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-4 font-display text-2xl transition-colors group-hover:text-accent sm:text-3xl">
                    {s.title}
                  </h3>
                  <p className="mt-3 max-w-md text-muted">{s.body}</p>
                  <span className="pointer-events-none absolute -right-4 -top-6 font-display text-8xl text-fg/[0.03] transition-colors group-hover:text-accent/10">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- TICKETING ---------------- */}
      <section id="ticketing" className="shell scroll-mt-24 py-20 sm:py-24">
        <SectionHeading
          kicker="How ticketing works"
          title={<>No screenshots. No fakes.</>}
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {ticketSteps.map((s, i) => (
            <Reveal key={s.n} delay={i * 80}>
              <div className="card card-hover relative h-full overflow-hidden p-7">
                <span className="font-display text-6xl text-accent/20">{s.n}</span>
                <h3 className="mt-4 font-display text-2xl">{s.t}</h3>
                <p className="mt-3 text-muted">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-8 rounded-2xl border border-line bg-elev p-6 text-sm text-muted">
          <span className="font-semibold text-fg">For developers:</span> tickets are
          verifiable over a secured HTTP API so your in-game entry system can check them with
          a single request. Reach out if you want to integrate our verification into your own
          experience.
        </div>
      </section>

      {/* ---------------- THE CREW (real people) ---------------- */}
      {/* Real Roblox accounts or nothing - the same defence the /team page documents. When
          the crew table is empty we do not invent a single face; we say we're hiring, which
          is true, and point at the roles. */}
      <section className="border-y border-line bg-elev">
        <div className="shell py-20 sm:py-24">
          {crew.length ? (
            <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <Kicker>Who runs it</Kicker>
                <h2 className="display mt-4 text-4xl sm:text-5xl md:text-6xl">
                  A{" "}
                  <span className="text-accent tnum">{crew.length}</span>
                  -strong crew.
                </h2>
                <p className="mt-5 text-muted">
                  Builders, hosts, editors and moderators - real people on real Roblox
                  accounts, who turn an empty baseplate into a night people log in for.
                </p>
                <Link href="/team" className="btn btn-ghost mt-7">
                  Meet the crew
                </Link>
              </div>

              {/* Real faces. Overlapping avatars, then a chip for anyone past the first
                  seven - and that chip only appears when the count is genuinely higher. */}
              <div className="flex items-center">
                <div className="flex -space-x-3">
                  {faces.map((m) =>
                    m.avatarUrl ? (
                      // Roblox CDN URLs rotate and aren't in next.config's remotePatterns,
                      // so a plain <img> that tolerates a rotted link - never next/image,
                      // which would throw. Same call /team makes.
                      // eslint-disable-next-line @next/next/no-img-element
                      <a
                        key={m.id}
                        href={robloxProfileUrl(m.robloxId)}
                        target="_blank"
                        rel="noreferrer"
                        title={`${m.displayName} · ${m.role}`}
                      >
                        <img
                          src={m.avatarUrl}
                          alt=""
                          loading="lazy"
                          className="h-14 w-14 rounded-full border-2 border-elev bg-accent-soft object-cover transition-transform hover:-translate-y-1"
                        />
                      </a>
                    ) : (
                      <a
                        key={m.id}
                        href={robloxProfileUrl(m.robloxId)}
                        target="_blank"
                        rel="noreferrer"
                        title={`${m.displayName} · ${m.role}`}
                        className="grid h-14 w-14 place-items-center rounded-full border-2 border-elev bg-accent-soft font-display text-sm text-accent transition-transform hover:-translate-y-1"
                      >
                        {initials(m.displayName)}
                      </a>
                    ),
                  )}
                  {crew.length > faces.length ? (
                    <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-elev bg-bg font-display text-sm text-fg">
                      +{crew.length - faces.length}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-xl">
                <Kicker>Who runs it</Kicker>
                <h2 className="display mt-4 text-4xl sm:text-5xl md:text-6xl">
                  The crew is forming.
                </h2>
                <p className="mt-5 text-muted">
                  Builders, hosts, editors and moderators - we open new roles before every
                  season. If you take events seriously, your name could be on the credits.
                </p>
              </div>
              <Link href="/careers" className="btn btn-accent shrink-0">
                See open roles
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ---------------- WHAT THE CROWD SAID (real quotes) ---------------- */}
      {/* Guard on the SECTION, not the marquee: QuoteMarquee returns null for an empty
          array, but the heading above it would still ship "What the crowd said" over a strip
          of nothing. Real, published quotes or the whole section is absent. */}
      {quotes.length ? (
        <section className="overflow-hidden border-b border-line py-20 sm:py-24">
          <div className="shell">
            <SectionHeading kicker="Word of mouth" title="What the crowd said" />
          </div>
          <QuoteMarquee
            quotes={quotes.map((q) => ({
              body: q.body,
              author: q.author,
              meta: q.meta ?? "",
            }))}
            className="mt-12"
          />
        </section>
      ) : null}

      {/* ---------------- HOUSE RULES ---------------- */}
      <section className="shell py-20 sm:py-24">
        <SectionHeading kicker="How we operate" title="The house rules" />
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
          {values.map((v, i) => (
            <Reveal key={v.k} delay={i * 70} className="h-full">
              <div className="group flex h-full flex-col bg-bg p-8 transition-colors hover:bg-elev">
                <span className="font-mono text-xs font-bold tracking-[0.2em] text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-4 font-display text-2xl">{v.k}</h3>
                <p className="mt-3 text-muted">{v.v}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------- FINAL CTA ---------------- */}
      <section className="shell pb-20 sm:pb-24">
        <div className="panel-paper relative overflow-hidden p-10 text-center sm:p-16">
          <h2 className="display text-5xl text-black sm:text-7xl">
            Come to a show.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-black/70">
            {upcoming.length
              ? "The best way to understand what we do is to be on the floor when the lights drop - and the next one is already on the calendar."
              : "The best way to understand what we do is to be on the floor when the lights drop."}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 rounded-[3px] bg-black px-6 py-3 text-[12px] font-bold uppercase tracking-[0.09em] text-paper transition-colors hover:bg-accent hover:text-accent-ink"
            >
              {upcoming.length ? "See upcoming events" : "See past events"}
            </Link>
            <a
              href={site.socials.discord}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-[3px] border border-black/25 px-6 py-3 text-[12px] font-bold uppercase tracking-[0.09em] text-black transition-colors hover:bg-black hover:text-paper"
            >
              Join the Discord
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

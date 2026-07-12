import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { Kicker, SectionHeading } from "@/components/ui";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "RO. Nation LIVE is a Roblox event management group producing shows, showcases and tournaments — with real ticketing and in-experience door verification.",
};

const services = [
  {
    title: "Event production",
    body: "Concept, run-of-show, hosting and live direction. We treat every event like a real production, not a hangout.",
  },
  {
    title: "Venue & stage building",
    body: "Custom venues built in Studio and optimised for big servers — stages, lighting rigs and interactive set pieces.",
  },
  {
    title: "Ticketing & entry",
    body: "Free, account-tied tickets with unique codes, capacity control, and live check-in verified inside the experience.",
  },
  {
    title: "Talent & casting",
    body: "Hosts, performers, DJs and commentators from our roster — vetted, briefed and show-ready.",
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
    d: "Join the event experience on Roblox when doors open. Your ticket lives in your account — nothing to screenshot.",
  },
  {
    n: "03",
    t: "Verified at the door",
    d: "Our entry system checks your ticket against our API in real time. Valid tickets get waved in; everyone else waits at the gate.",
  },
];

export default function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="accent-glow pointer-events-none absolute inset-x-0 -top-10 h-72" />
        <div className="shell relative py-20 sm:py-24">
          <Kicker>Who we are</Kicker>
          <h1 className="display mt-6 max-w-4xl text-5xl leading-[0.9] sm:text-7xl md:text-8xl">
            We build the nights people log in for.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted">
            {site.name} is a Roblox event management group. We produce live
            shows, showcases, tournaments and festivals — handling everything
            from the first block placed in Studio to verifying tickets at the
            door. What started as a few friends throwing shows is now a full
            crew of builders, hosts, editors and moderators.
          </p>
        </div>
      </section>

      {/* Services */}
      <section className="border-y border-line bg-elev">
        <div className="shell py-20">
          <SectionHeading kicker="What we do" title="Full-service events" />
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {services.map((s, i) => (
              <Reveal key={s.title} delay={i * 70}>
                <div className="card h-full p-7">
                  <h3 className="font-display text-2xl">{s.title}</h3>
                  <p className="mt-3 text-muted">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Ticketing explainer */}
      <section id="ticketing" className="shell scroll-mt-24 py-20 sm:py-24">
        <SectionHeading
          kicker="How ticketing works"
          title={<>No screenshots. No fakes.</>}
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {ticketSteps.map((s, i) => (
            <Reveal key={s.n} delay={i * 80}>
              <div className="card relative h-full overflow-hidden p-7">
                <span className="font-display text-6xl text-accent/20">
                  {s.n}
                </span>
                <h3 className="mt-4 font-display text-2xl">{s.t}</h3>
                <p className="mt-3 text-muted">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-8 rounded-2xl border border-line bg-elev p-6 text-sm text-muted">
          <span className="font-semibold text-fg">For developers:</span> tickets
          are verifiable over a secured HTTP API so your in-game entry system can
          check them with a single request. Reach out if you want to integrate
          our verification into your own experience.
        </div>
      </section>

      {/* Values */}
      <section className="border-t border-line bg-elev">
        <div className="shell py-20">
          <SectionHeading kicker="How we operate" title="The house rules" />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {values.map((v, i) => (
              <Reveal key={v.k} delay={i * 70}>
                <div className="border-l-2 border-accent pl-5">
                  <h3 className="font-display text-2xl">{v.k}</h3>
                  <p className="mt-2 text-muted">{v.v}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="shell py-20">
        <div className="panel-paper p-10 text-center sm:p-16">
          <h2 className="display text-5xl text-black sm:text-7xl">
            Come to a show.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-black/70">
            The best way to understand what we do is to be on the floor when the
            lights drop.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 rounded-[3px] bg-black px-6 py-3 text-[12px] font-bold uppercase tracking-[0.09em] text-paper transition-colors hover:bg-accent hover:text-accent-ink"
            >
              See upcoming events
            </Link>
            <Link
              href="/careers"
              className="inline-flex items-center gap-2 rounded-[3px] border border-black/25 px-6 py-3 text-[12px] font-bold uppercase tracking-[0.09em] text-black transition-colors hover:bg-black hover:text-paper"
            >
              Join the crew
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

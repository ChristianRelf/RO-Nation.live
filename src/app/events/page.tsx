import type { Metadata } from "next";
import Link from "next/link";
import { getUpcomingEvents, getPastEvents } from "@/lib/queries";
import { EventCard } from "@/components/event-card";
import { Reveal } from "@/components/reveal";
import { Kicker } from "@/components/ui";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Events",
  description:
    "Upcoming and past RO. Nation LIVE events - shows, showcases, tournaments and festivals inside Roblox.",
};

export default async function EventsPage() {
  const [upcoming, past] = await Promise.all([
    // null = RNL's own events. A partner's live on their own site.
    getUpcomingEvents(null),
    getPastEvents(null, 9),
  ]);

  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-64" />
      <div className="shell relative pt-16 sm:pt-20">
        <Kicker>What&apos;s on</Kicker>
        <h1 className="display mt-5 text-5xl sm:text-6xl md:text-7xl">
          Events
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Reserve your spot before the floor fills up. Tickets are free, tied to
          your Roblox account, and verified live at the door.
        </p>
      </div>

      {/* Upcoming */}
      <section className="shell pb-4 pt-14">
        <div className="mb-8 flex items-center gap-3">
          <h2 className="font-display text-2xl">Upcoming</h2>
          <span className="pill">{upcoming.length} on sale</span>
        </div>
        {upcoming.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((event, i) => (
              <Reveal key={event.id} delay={(i % 3) * 60}>
                <EventCard event={event} priority={i < 3} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="card grid place-items-center px-6 py-16 text-center">
            <p className="font-display text-2xl">Nothing on sale right now</p>
            <p className="mt-2 max-w-sm text-muted">
              New shows drop regularly. Join the Discord to get the alert first.
            </p>
            <a href={site.socials.discord} className="btn btn-ghost mt-6">
              Join the Discord
            </a>
          </div>
        )}
      </section>

      {/* Past */}
      {past.length ? (
        <section className="shell py-14">
          <div className="mb-8 flex items-center gap-3">
            <h2 className="font-display text-2xl">Past events</h2>
            <span className="pill">Recap</span>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((event, i) => (
              <Reveal key={event.id} delay={(i % 3) * 60}>
                <EventCard event={event} />
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      <div className="shell pb-8">
        <div className="card flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <p className="text-muted">
            Want your own event produced by our team?
          </p>
          <Link href="/contact" className="btn btn-ghost">
            Work with us →
          </Link>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { partnerBySlug } from "@/lib/partners/registry";
import { assertPartnerFeature } from "@/lib/partners/guard";
import { getPastEvents, getUpcomingEvents } from "@/lib/queries";
import { EventCard } from "@/components/event-card";
import { Reveal } from "@/components/reveal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shows" };

export default async function PartnerEventsPage({
  params,
}: {
  params: { slug: string };
}) {
  const partner = partnerBySlug(params.slug);
  if (!partner) notFound();
  assertPartnerFeature(partner, "events");

  // Scoped to this partner. RNL's own events never appear here, and this
  // partner's never appear on RNL's /events — see lib/queries.ts.
  const [upcoming, past] = await Promise.all([
    getUpcomingEvents(partner.slug),
    getPastEvents(partner.slug, 6),
  ]);

  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-64" />

      <div className="shell relative pt-16 sm:pt-20">
        <p className="kicker text-accent">What&apos;s on</p>
        <h1 className="display mt-5 text-5xl sm:text-6xl md:text-7xl">Shows</h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Free tickets, tied to your Roblox account and verified at the door.
          One per person — bring the crew, but everyone needs their own.
        </p>
      </div>

      <section className="shell pb-4 pt-14">
        <div className="mb-8 flex items-center gap-3">
          <h2 className="display text-2xl">Upcoming</h2>
          <span className="pill">{upcoming.length} on sale</span>
        </div>

        {upcoming.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((event, i) => (
              <Reveal key={event.id} delay={(i % 3) * 60}>
                {/* Their placeholder, not RNL's — see EventCard.fallbackSrc. */}
                <EventCard
                  event={event}
                  priority={i < 3}
                  fallbackSrc={partner.eventPlaceholderUrl}
                />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="card grid place-items-center px-6 py-16 text-center">
            <p className="display text-2xl">Nothing on sale right now</p>
            <p className="mt-2 max-w-sm text-muted">
              The next show hasn&apos;t been announced. Check back soon.
            </p>
            <Link href="/" className="btn btn-ghost mt-6">
              Back to the home page
            </Link>
          </div>
        )}
      </section>

      {past.length ? (
        <section className="shell py-14">
          <div className="mb-8 flex items-center gap-3">
            <h2 className="display text-2xl">Past shows</h2>
            <span className="pill">Archive</span>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((event, i) => (
              <Reveal key={event.id} delay={(i % 3) * 60}>
                <EventCard event={event} fallbackSrc={partner.eventPlaceholderUrl} />
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

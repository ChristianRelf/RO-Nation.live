import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getEventBySlug } from "@/lib/queries";
import { getUserSession } from "@/lib/session";
import { StatusBadge, Kicker } from "@/components/ui";
import { TierSummary } from "@/components/ticket/tier-summary";
import { CrowdFacepile } from "@/components/ticket/crowd-facepile";
import { FollowButton } from "@/components/account/follow-button";
import { WaitlistButton } from "@/components/account/waitlist-button";
import {
  dateBlock,
  formatDate,
  formatTime,
  isPast,
  relativeDays,
} from "@/lib/format";
import { offersForEvent } from "@/lib/tickets/offers";
import { anyAvailable } from "@/lib/tickets/pricing";
import { site } from "@/lib/site";
import { env } from "@/lib/env";
import { absoluteUrl } from "@/lib/url";
import { JsonLd } from "@/components/json-ld";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const event = await getEventBySlug(null, params.slug);
  if (!event) return { title: "Event not found" };
  const description = event.tagline ?? event.description.slice(0, 150);
  const path = `/events/${event.slug}`;
  return {
    title: event.title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: event.title,
      description,
      type: "website",
      url: path,
      // The real poster, made absolute for the crawler. No thumbnail → this key
      // is absent and the site-wide branded card (app/opengraph-image) fills in.
      images: event.thumbnailUrl ? [absoluteUrl(event.thumbnailUrl)] : undefined,
    },
  };
}

const reserveErrors: Record<string, string> = {
  soldout: "This event just sold out - no spots left.",
  past: "This event has already taken place.",
  unavailable: "This event isn't available for reservations.",
};

export default async function EventPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { error?: string };
}) {
  const event = await getEventBySlug(null, params.slug);
  if (!event) notFound();

  const session = await getUserSession();
  const ended = isPast(event.startsAt);
  const remaining =
    event.capacity > 0 ? Math.max(0, event.capacity - event.ticketsCount) : null;
  const soldOut = remaining !== null && remaining <= 0;

  const myTicket = session
    ? await prisma.ticket.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: session.uid } },
      })
    : null;
  const hasTicket = Boolean(myTicket && myTicket.status !== "CANCELLED");

  // Whether this member follows the show - drives the Follow / Following button below.
  const following = session
    ? Boolean(
        await prisma.eventFollow.findUnique({
          where: {
            userId_eventId: { userId: session.uid, eventId: event.id },
          },
        }),
      )
    : false;

  // Whether they are queued for this show - drives the waitlist CTA when it is full.
  const onWaitlist = session
    ? Boolean(
        await prisma.waitlist.findUnique({
          where: {
            userId_eventId: { userId: session.uid, eventId: event.id },
          },
        }),
      )
    : false;

  const offers = await offersForEvent(event);
  const available = anyAvailable(offers);
  // Nothing on sale, but nothing sold out either - every tier is priced in Robux
  // and Robux sales are off. That is not "sold out", and saying so would be a lie
  // to anyone still hoping to get in.
  const notOnSale =
    !available && offers.every((o) => o.blockedReason === "locked");
  const allFree = offers.every((o) => o.priceRobux === 0);

  const { day, month } = dateBlock(event.startsAt);
  const error = searchParams.error ? reserveErrors[searchParams.error] : null;

  // Structured data, every field read from the real row. RNL runs inside Roblox,
  // so the event is an online one with a VirtualLocation - the experience URL when
  // there is one, the event page otherwise. A price is asserted only when entry is
  // genuinely free; a Robux-priced tier is left without a price rather than dressed
  // up in a currency it is not, in keeping with the rest of the site.
  const eventLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: event.startsAt.toISOString(),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    location: {
      "@type": "VirtualLocation",
      url: event.placeUrl || absoluteUrl(`/events/${event.slug}`),
    },
    image: event.thumbnailUrl ? [absoluteUrl(event.thumbnailUrl)] : undefined,
    description: event.tagline ?? event.description.slice(0, 300),
    url: absoluteUrl(`/events/${event.slug}`),
    organizer: {
      "@type": "Organization",
      name: site.name,
      url: env.siteUrl,
    },
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/events/${event.slug}`),
      availability: soldOut
        ? "https://schema.org/SoldOut"
        : "https://schema.org/InStock",
      ...(allFree ? { price: "0", priceCurrency: "USD" } : {}),
    },
  };

  return (
    <article>
      <JsonLd data={eventLd} />
      {/* Banner */}
      <div className="relative">
        <div className="relative h-[42vh] min-h-[320px] w-full overflow-hidden sm:h-[52vh]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.thumbnailUrl || "/placeholders/event-01.svg"}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-bg/20" />
        </div>
        <div className="shell relative -mt-28 pb-2 sm:-mt-32">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={ended ? "past" : soldOut ? "soldout" : "upcoming"}>
              {ended ? "Past event" : soldOut ? "Sold out" : relativeDays(event.startsAt)}
            </StatusBadge>
            <span className="pill">{event.category}</span>
          </div>
          <h1 className="display mt-4 max-w-4xl text-5xl sm:text-6xl md:text-7xl">
            {event.title}
          </h1>
          {event.tagline ? (
            <p className="mt-4 max-w-2xl text-lg text-muted">{event.tagline}</p>
          ) : null}
        </div>
      </div>

      {/* Body */}
      <div className="shell grid gap-10 py-12 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
        <div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Detail label="Date" value={formatDate(event.startsAt)} />
            <Detail
              label="Doors / Start"
              value={`${
                event.doorsAt ? formatTime(event.doorsAt) + " / " : ""
              }${formatTime(event.startsAt)}`}
            />
            <Detail label="Venue" value={event.venue ?? "TBA"} />
          </div>

          <div className="mt-10">
            <Kicker>About this event</Kicker>
            <div className="prose-invert mt-5 whitespace-pre-line text-[17px] leading-relaxed text-muted">
              {event.description}
            </div>
          </div>

          {event.placeUrl ? (
            <a
              href={event.placeUrl}
              className="btn btn-ghost mt-8"
              target="_blank"
              rel="noreferrer"
            >
              Open the experience on Roblox →
            </a>
          ) : null}
        </div>

        {/* Reserve panel */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card overflow-hidden">
            <div className="flex items-center gap-4 border-b border-line p-5">
              <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-bg leading-none">
                <span className="font-display text-2xl">{day}</span>
                <span className="mt-1 text-[10px] font-bold tracking-widest text-accent">
                  {month}
                </span>
              </div>
              <div>
                <p className="font-display text-xl leading-tight">
                  {formatTime(event.startsAt)}
                </p>
                <p className="text-sm text-muted">{formatDate(event.startsAt)}</p>
              </div>
            </div>

            <div className="p-5">
              {remaining !== null ? (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Capacity</span>
                    <span className="font-semibold">
                      {event.ticketsCount}/{event.capacity}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{
                        width: `${Math.min(
                          100,
                          (event.ticketsCount / event.capacity) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="mb-4 text-sm text-muted">Unlimited entry</p>
              )}

              {/* The crowd, as faces. Reframes the same holders the capacity line
                  counts into a reason to come - see components/ticket/crowd-facepile. */}
              <CrowdFacepile eventId={event.id} />

              <TierSummary offers={offers} />

              {error ? (
                <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              ) : null}

              {ended ? (
                <button
                  disabled
                  className="btn w-full cursor-not-allowed border border-line text-muted"
                >
                  Event has ended
                </button>
              ) : hasTicket ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
                    You&apos;re going - ticket{" "}
                    <span className="font-mono font-semibold">
                      {myTicket!.code}
                    </span>
                  </div>
                  <Link
                    href={`/tickets/${myTicket!.id}`}
                    className="btn btn-accent w-full"
                  >
                    View my ticket
                  </Link>
                </div>
              ) : notOnSale ? (
                <button
                  disabled
                  className="btn w-full cursor-not-allowed border border-line text-muted"
                >
                  Not on sale yet
                </button>
              ) : !available ? (
                <button
                  disabled
                  className="btn w-full cursor-not-allowed border border-line text-muted"
                >
                  Sold out
                </button>
              ) : session ? (
                <Link
                  href={`/events/${event.slug}/reserve`}
                  className="btn btn-accent w-full text-base"
                >
                  {allFree ? "Reserve free ticket" : "Get tickets"}
                </Link>
              ) : (
                <Link
                  href={`/account?returnTo=${encodeURIComponent(
                    `/events/${event.slug}`,
                  )}`}
                  className="btn btn-accent w-full text-base"
                >
                  Sign in to reserve
                </Link>
              )}

              <p className="mt-4 text-center text-xs text-faint">
                {allFree ? "Free entry · verified" : "Verified"} in-experience at
                the door
              </p>
            </div>
          </div>

          {/* Waitlist - only when the room is genuinely full (not when a priced tier
              is merely locked with seats still free) and they could still take a
              spot: not ended, and not already holding one. */}
          {soldOut && !ended && !hasTicket ? (
            <div className="mt-4">
              <WaitlistButton
                eventId={event.id}
                onWaitlist={onWaitlist}
                signedIn={Boolean(session)}
                returnTo={`/events/${event.slug}`}
              />
            </div>
          ) : null}

          {/* Watchlist + calendar. Follow tells us to notify this member if the show
              moves or is cancelled; the .ics is a plain download for anyone. */}
          <div className="mt-4 grid gap-2">
            <FollowButton
              eventId={event.id}
              following={following}
              signedIn={Boolean(session)}
              returnTo={`/events/${event.slug}`}
            />
            <a
              href={`/events/${event.slug}/calendar`}
              download
              className="btn btn-ghost w-full"
            >
              Add to calendar
            </a>
          </div>

          <div className="mt-4 rounded-2xl border border-line bg-elev p-5 text-sm text-muted">
            <p className="font-semibold text-fg">Bringing friends?</p>
            <p className="mt-1">
              Everyone needs their own ticket to get through the door. Share the
              event and get your crew signed up.
            </p>
            <a href={site.socials.discord} className="mt-3 inline-block text-accent">
              Share in the Discord →
            </a>
          </div>
        </aside>
      </div>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-elev p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
        {label}
      </p>
      <p className="mt-1 font-medium text-fg">{value}</p>
    </div>
  );
}

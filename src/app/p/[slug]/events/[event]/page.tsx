import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { partnerBySlug } from "@/lib/partners/registry";
import { assertPartnerFeature } from "@/lib/partners/guard";
import { getEventBySlug } from "@/lib/queries";
import { getUserSession } from "@/lib/session";
import { StatusBadge } from "@/components/ui";
import { TierSummary } from "@/components/ticket/tier-summary";
import {
  dateBlock,
  formatDate,
  formatTime,
  isPast,
  relativeDays,
} from "@/lib/format";
import { offersForEvent } from "@/lib/tickets/offers";
import { anyAvailable } from "@/lib/tickets/pricing";

export const dynamic = "force-dynamic";

// The dynamic segment is [event], not [slug] — [slug] is already taken by the
// partner one level up, and Next forbids two different names for the same
// position in a route. The visitor never sees either: the pretty URL is
// sleeptokenro.ronation.live/events/<event>.

type Params = { params: { slug: string; event: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const partner = partnerBySlug(params.slug);
  if (!partner) return {};

  const event = await getEventBySlug(partner.slug, params.event);
  if (!event) return { title: "Show not found" };

  return {
    title: event.title,
    description: event.tagline ?? event.description.slice(0, 150),
  };
}

const reserveErrors: Record<string, string> = {
  soldout: "This show just sold out — no spots left.",
  past: "This show has already taken place.",
  unavailable: "This show isn't available for reservations.",
};

export default async function PartnerEventPage({
  params,
  searchParams,
}: Params & { searchParams: { error?: string } }) {
  const partner = partnerBySlug(params.slug);
  if (!partner) notFound();
  // Tickets and shows only exist for a partner who HAS the events feature.
  // Without this the routes stand even when the nav hides them, and a route
  // that exists is a route somebody reaches.
  assertPartnerFeature(partner, "events");

  // Scoped: an RNL slug requested on this host resolves to null, not to RNL's
  // show rendered in the partner's brand. See getEventBySlug.
  const event = await getEventBySlug(partner.slug, params.event);
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

  const offers = await offersForEvent(event);
  const available = anyAvailable(offers);
  // Nothing on sale, but nothing sold out either — every tier is priced in Robux
  // and Robux sales are off. That is not "sold out", and saying so would be a lie
  // to anyone still hoping to get in.
  const notOnSale =
    !available && offers.every((o) => o.blockedReason === "locked");
  const allFree = offers.every((o) => o.priceRobux === 0);

  const { day, month } = dateBlock(event.startsAt);
  const error = searchParams.error ? reserveErrors[searchParams.error] : null;

  return (
    <article>
      {/* Banner. No key art yet, so the title carries it — over the grid and a
          pool of accent, the same CSS-only atmosphere as the home page. */}
      <div className="relative overflow-hidden border-b border-line">
        <div className="hairline-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-56" />
        {event.thumbnailUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.thumbnailUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/30" />
          </>
        ) : null}

        <div className="shell relative py-20 sm:py-28">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge
              status={ended ? "past" : soldOut ? "soldout" : "upcoming"}
            >
              {ended
                ? "Past show"
                : soldOut
                  ? "Sold out"
                  : relativeDays(event.startsAt)}
            </StatusBadge>
            <span className="pill">{event.category}</span>
          </div>

          <h1 className="display mt-6 max-w-4xl text-5xl sm:text-6xl md:text-7xl">
            {event.title}
          </h1>
          {event.tagline ? (
            <p className="mt-5 max-w-2xl text-lg text-muted">{event.tagline}</p>
          ) : null}
        </div>
      </div>

      {/* Body */}
      <div className="shell grid gap-10 py-14 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
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

          <div className="mt-12">
            <p className="kicker text-accent">About this show</p>
            <div className="mt-5 whitespace-pre-line text-[17px] leading-relaxed text-muted">
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
              <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center border border-line bg-bg leading-none">
                <span className="display text-2xl">{day}</span>
                <span className="mt-1 text-[10px] font-bold tracking-widest text-accent">
                  {month}
                </span>
              </div>
              <div>
                <p className="display text-xl leading-tight">
                  {formatTime(event.startsAt)}
                </p>
                <p className="text-sm text-muted">
                  {formatDate(event.startsAt)}
                </p>
              </div>
            </div>

            <div className="p-5">
              {remaining !== null ? (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Capacity</span>
                    <span className="tnum font-semibold">
                      {event.ticketsCount}/{event.capacity}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden bg-bg">
                    <div
                      className="h-full bg-accent"
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

              <TierSummary offers={offers} />

              {error ? (
                <p className="mb-4 border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              ) : null}

              {ended ? (
                <button
                  disabled
                  className="btn w-full cursor-not-allowed border border-line text-muted"
                >
                  Show has ended
                </button>
              ) : hasTicket ? (
                <div className="space-y-3">
                  <div className="border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
                    You&apos;re going — ticket{" "}
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

          <div className="mt-4 border border-line bg-elev p-5 text-sm text-muted">
            <p className="font-semibold text-fg">Bringing friends?</p>
            <p className="mt-1">
              Everyone needs their own ticket to get through the door. Share the
              show and get your crew signed up.
            </p>
          </div>
        </aside>
      </div>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line bg-elev p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
        {label}
      </p>
      <p className="mt-1 font-medium text-fg">{value}</p>
    </div>
  );
}

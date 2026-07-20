import Link from "next/link";
import type { Event } from "@prisma/client";
import { Kicker, StatusBadge } from "@/components/ui";
import { partnerOrigin } from "@/lib/partners/urls";
import { formatDate, formatDateTime, isPast } from "@/lib/format";
import type { AccountHome as AccountHomeData, TicketWithEvent } from "@/lib/account";
import type { LoyaltyStatus } from "@/lib/loyalty";

// The signed-in member's home. A presentational server component: getAccountHome() does the
// reads, this lays them out. Every show link routes correctly across hosts - a partner event
// gets an ABSOLUTE partnerOrigin URL (a relative /events/<slug> would 404 under RNL's own
// scope), an RNL event a relative one, and a ticket always /tickets/<id>.

function eventHref(event: Pick<Event, "slug" | "partnerId">) {
  return event.partnerId
    ? `${partnerOrigin(event.partnerId)}/events/${event.slug}`
    : `/events/${event.slug}`;
}

/** External (partner) links open in a new tab; RNL links navigate in place. */
function linkProps(event: Pick<Event, "partnerId">) {
  return event.partnerId
    ? { target: "_blank" as const, rel: "noreferrer" as const }
    : {};
}

export function AccountHome({
  home,
  displayName,
  username,
}: {
  home: AccountHomeData;
  displayName: string;
  username: string;
}) {
  const { notifications, unseenCount, upcoming, attended, loyalty, watchlist, discord } =
    home;
  const nothingYet =
    upcoming.length === 0 && watchlist.length === 0 && attended.length === 0;

  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-64" />

      <div className="shell relative pt-16 sm:pt-20">
        <Kicker>Your account</Kicker>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-accent text-2xl font-bold text-accent-ink">
            {displayName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="display text-4xl sm:text-5xl">{displayName}</h1>
            <p className="text-muted">@{username}</p>
          </div>
          <a href="/api/auth/logout" className="btn btn-ghost ml-auto">
            Sign out
          </a>
        </div>
      </div>

      <div className="shell space-y-14 py-14">
        {/* What changed - the persistent record behind the modal. */}
        {notifications.length > 0 ? (
          <Section title="Updates" hint={unseenCount ? `${unseenCount} new` : undefined}>
            <ul className="divide-y divide-line border-y border-line">
              {notifications.map((n) => (
                <li key={n.id} className="flex gap-3 py-4">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      n.seenAt ? "bg-line-strong" : "bg-accent"
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-fg">{n.title}</p>
                    {n.body ? (
                      <p className="mt-0.5 text-sm text-muted">{n.body}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-faint">
                      {formatDateTime(n.createdAt)}
                      {n.url ? (
                        <>
                          {" · "}
                          <a href={n.url} className="link-underline text-accent">
                            View the event
                          </a>
                        </>
                      ) : null}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {/* Upcoming tickets. */}
        <Section
          title="Your tickets"
          hint={upcoming.length ? undefined : "None coming up"}
          action={{ label: "All tickets", href: "/tickets" }}
        >
          {upcoming.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {upcoming.map((t) => (
                <TicketCard key={t.id} ticket={t} />
              ))}
            </div>
          ) : (
            <Empty>
              No upcoming tickets.{" "}
              <Link href="/events" className="link-underline text-accent">
                Browse shows
              </Link>{" "}
              and reserve one - it&apos;s free.
            </Empty>
          )}
        </Section>

        {/* Watchlist. */}
        {watchlist.length ? (
          <Section title="Watchlist" hint="Shows you follow">
            <div className="grid gap-3 sm:grid-cols-2">
              {watchlist.map((e) => (
                <a
                  key={e.id}
                  href={eventHref(e)}
                  {...linkProps(e)}
                  className="card card-hover flex items-center justify-between gap-4 p-5"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-display text-lg">
                      {e.title}
                    </span>
                    <span className="text-sm text-muted">
                      {formatDate(e.startsAt)}
                    </span>
                  </span>
                  <StatusBadge status={isPast(e.startsAt) ? "past" : "upcoming"}>
                    {isPast(e.startsAt) ? "Past" : "Upcoming"}
                  </StatusBadge>
                </a>
              ))}
            </div>
          </Section>
        ) : null}

        {/* Shows attended - derived from door check-in. */}
        {attended.length ? (
          <Section
            title="Shows you've been to"
            hint={loyalty.current ? loyalty.current.name : undefined}
          >
            <LoyaltyBanner loyalty={loyalty} />
            <ul className="divide-y divide-line border-y border-line">
              {attended.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
                >
                  <span className="font-medium text-fg">{t.event.title}</span>
                  <span className="font-mono text-xs uppercase tracking-[0.1em] text-faint">
                    {formatDate(t.event.startsAt)}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {/* Discord + quick links. */}
        <Section title="Your links">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="card flex items-center justify-between gap-4 p-5">
              <div className="min-w-0">
                <p className="font-display text-lg">Discord</p>
                <p className="truncate text-sm text-muted">
                  {discord
                    ? `Linked${discord.username ? ` · @${discord.username}` : ""}`
                    : "Not linked yet"}
                </p>
              </div>
              <Link href="/account/link" className="btn btn-ghost shrink-0">
                {discord ? "Manage" : "Link"}
              </Link>
            </div>

            <div className="card flex flex-col justify-center gap-2 p-5 text-sm">
              <Link href="/events" className="link-underline text-accent">
                Browse events →
              </Link>
              <Link href="/tickets" className="link-underline text-accent">
                My tickets →
              </Link>
              {/* Cross-host - plain <a> so it hard-navigates instead of a failing RSC fetch. */}
              <a href="/merch" className="link-underline text-accent">
                Shop merch →
              </a>
            </div>
          </div>
        </Section>

        {nothingYet ? (
          <p className="text-sm text-faint">
            Nothing here yet. Follow a show or reserve a ticket and it&apos;ll show up
            here - and if a show you&apos;re on ever moves or is cancelled, we&apos;ll
            tell you the moment you next open the site.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The member's standing, from door check-ins. Only rendered where there IS a
 * standing (attended ≥ 1), so `current` is never null here - but it is guarded
 * anyway, because a component that trusts its caller is a component that breaks
 * the day the caller changes. See lib/loyalty.
 */
function LoyaltyBanner({ loyalty }: { loyalty: LoyaltyStatus }) {
  if (!loyalty.current) return null;

  // Progress across the CURRENT rung: how far from this tier's threshold to the
  // next one. At the top tier there is no next, so the bar is full and the line
  // just celebrates rather than nagging.
  const progress =
    loyalty.next && loyalty.toNext !== null
      ? Math.min(
          100,
          Math.round(
            ((loyalty.attended - loyalty.current.min) /
              (loyalty.next.min - loyalty.current.min)) *
              100,
          ),
        )
      : 100;

  return (
    <div className="mb-5 card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-accent">
            {loyalty.current.name}
          </span>
          <span className="text-sm text-muted">
            {loyalty.attended} show{loyalty.attended === 1 ? "" : "s"} attended
          </span>
        </p>
        {loyalty.next && loyalty.toNext !== null ? (
          <p className="mt-2 text-sm text-faint">
            {loyalty.toNext} more to{" "}
            <span className="font-semibold text-fg">{loyalty.next.name}</span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-faint">
            Top of the list - thanks for coming to so many.
          </p>
        )}
      </div>
      <div className="w-full sm:w-40">
        <div className="h-1.5 overflow-hidden rounded-full bg-bg">
          <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-2xl">
          {title}
          {hint ? (
            <span className="ml-3 align-middle text-sm font-normal text-faint">
              {hint}
            </span>
          ) : null}
        </h2>
        {action ? (
          <Link
            href={action.href}
            className="text-sm font-semibold text-accent hover:text-fg"
          >
            {action.label} →
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function TicketCard({ ticket }: { ticket: TicketWithEvent }) {
  const e = ticket.event;
  return (
    <Link
      href={`/tickets/${ticket.id}`}
      className="card card-hover flex items-center justify-between gap-4 p-5"
    >
      <span className="min-w-0">
        <span className="block truncate font-display text-lg">{e.title}</span>
        <span className="text-sm text-muted">{formatDate(e.startsAt)}</span>
      </span>
      <StatusBadge status={ticket.status === "CHECKED_IN" ? "past" : "upcoming"}>
        {ticket.status === "CHECKED_IN" ? "Checked in" : "Reserved"}
      </StatusBadge>
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="card p-6 text-sm text-muted">{children}</div>
  );
}

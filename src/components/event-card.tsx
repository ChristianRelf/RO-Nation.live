import Link from "next/link";
import { dateBlock, formatTime, isPast, relativeDays } from "@/lib/format";
import { StatusBadge } from "./ui";

export type EventCardData = {
  slug: string;
  title: string;
  tagline?: string | null;
  category: string;
  venue?: string | null;
  thumbnailUrl?: string | null;
  startsAt: Date | string;
  capacity: number;
  ticketsCount?: number;
};

function statusFor(e: EventCardData): {
  key: "past" | "soldout" | "soon" | "upcoming";
  label: string;
} {
  if (isPast(e.startsAt)) return { key: "past", label: "Past" };
  if (e.capacity > 0 && (e.ticketsCount ?? 0) >= e.capacity)
    return { key: "soldout", label: "Sold out" };
  return { key: "upcoming", label: relativeDays(e.startsAt) };
}

export function EventCard({
  event,
  priority,
}: {
  event: EventCardData;
  priority?: boolean;
}) {
  const { day, month } = dateBlock(event.startsAt);
  const status = statusFor(event);
  const remaining =
    event.capacity > 0
      ? Math.max(0, event.capacity - (event.ticketsCount ?? 0))
      : null;

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group card card-hover relative flex flex-col overflow-hidden"
    >
      <div className="relative aspect-[4/3] overflow-hidden border-b border-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={event.thumbnailUrl || "/placeholders/event-01.svg"}
          alt=""
          loading={priority ? "eager" : "lazy"}
          className="h-full w-full object-cover grayscale-[0.15] transition-all duration-500 group-hover:scale-[1.04] group-hover:grayscale-0"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg/90 via-transparent to-transparent" />

        {/* date block */}
        <div className="absolute left-0 top-0 flex flex-col items-center border-b border-r border-white/15 bg-bg/85 px-3.5 py-2 leading-none">
          <span className="font-display text-2xl text-fg">{day}</span>
          <span className="mt-1 text-[9px] font-bold tracking-[0.2em] text-accent">
            {month}
          </span>
        </div>

        <div className="absolute right-3 top-3">
          <StatusBadge status={status.key}>{status.label}</StatusBadge>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
          <span>{event.category}</span>
          <span className="text-faint">/</span>
          <span className="tnum">{formatTime(event.startsAt)}</span>
        </div>
        <h3 className="mt-2 font-display text-2xl leading-[0.95] text-fg transition-colors group-hover:text-accent">
          {event.title}
        </h3>
        {event.venue ? (
          <p className="mt-2 text-sm text-muted">{event.venue}</p>
        ) : null}

        <div className="mt-auto flex items-center justify-between border-t border-line pt-3.5 text-[11px] font-bold uppercase tracking-[0.1em]">
          <span className="inline-flex items-center gap-1.5 text-fg">
            Details
            <span className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </span>
          {status.key === "upcoming" && remaining !== null ? (
            <span className="tnum text-faint">{remaining} left</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getEventBySlug } from "@/lib/queries";
import { getUserSession } from "@/lib/session";
import { reserveTicket } from "@/app/actions/tickets";
import { Kicker } from "@/components/ui";
import { dateBlock, formatDate, formatTime, isPast } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reserve ticket" };

const terms = [
  "Your ticket admits one person and is tied to your Roblox account — it can't be transferred or resold.",
  "Entry is verified in-experience at the door using your ticket code. Have it ready.",
  "RO. Nation LIVE may cancel, reschedule, or change the line-up of any event.",
  "You agree to follow Roblox Community Standards and event moderation while attending.",
  "Reserving a ticket you don't use may affect priority for future events.",
];

export default async function ReservePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { error?: string };
}) {
  const event = await getEventBySlug(params.slug);
  if (!event) notFound();

  const session = await getUserSession();
  if (!session) {
    redirect(
      `/account?returnTo=${encodeURIComponent(`/events/${params.slug}/reserve`)}`,
    );
  }

  if (isPast(event.startsAt)) redirect(`/events/${event.slug}?error=past`);

  // Already holding an active ticket? Jump straight to it.
  const existing = await prisma.ticket.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: session.uid } },
  });
  if (existing && existing.status !== "CANCELLED") {
    redirect(`/tickets/${existing.code}`);
  }

  const { day, month } = dateBlock(event.startsAt);
  const remaining =
    event.capacity > 0 ? Math.max(0, event.capacity - event.ticketsCount) : null;
  const soldOut = remaining !== null && remaining <= 0;
  if (soldOut) redirect(`/events/${event.slug}?error=soldout`);

  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-56" />
      <div className="shell relative pt-16 sm:pt-20">
        <Link
          href={`/events/${event.slug}`}
          className="text-sm text-muted hover:text-fg"
        >
          ← Back to event
        </Link>
        <Kicker className="mt-6">Checkout</Kicker>
        <h1 className="display mt-5 text-4xl sm:text-5xl">Reserve your ticket</h1>
        <p className="mt-4 max-w-xl text-muted">
          Review the details and accept the ticket terms to confirm your spot.
          Entry is free.
        </p>
      </div>

      <section className="shell grid gap-8 py-10 lg:grid-cols-[1fr_1fr]">
        {/* Order summary */}
        <div className="card h-fit p-6">
          <div className="flex items-center gap-4 border-b border-line pb-5">
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-bg leading-none">
              <span className="font-display text-2xl">{day}</span>
              <span className="mt-1 text-[10px] font-bold tracking-widest text-accent">
                {month}
              </span>
            </div>
            <div>
              <h2 className="font-display text-xl leading-tight">{event.title}</h2>
              <p className="mt-1 text-sm text-muted">
                {formatTime(event.startsAt)} · {formatDate(event.startsAt)}
              </p>
              {event.venue ? (
                <p className="text-sm text-muted">{event.venue}</p>
              ) : null}
            </div>
          </div>

          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted">General admission × 1</dt>
              <dd className="font-semibold text-fg">Free</dd>
            </div>
            {remaining !== null ? (
              <div className="flex items-center justify-between">
                <dt className="text-muted">Spots left</dt>
                <dd className="font-semibold text-fg">{remaining}</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between border-t border-line pt-3 text-base">
              <dt className="font-display">Total</dt>
              <dd className="font-display text-accent">£0.00</dd>
            </div>
          </dl>
        </div>

        {/* Terms + confirm */}
        <div className="card p-6">
          <h2 className="font-display text-xl">Terms &amp; conditions</h2>
          <ol className="mt-4 space-y-3 text-sm text-muted">
            {terms.map((t, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 font-mono text-xs text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ol>

          {searchParams.error === "terms" ? (
            <p className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              Please accept the terms &amp; conditions to continue.
            </p>
          ) : null}

          <form action={reserveTicket} className="mt-5">
            <input type="hidden" name="eventId" value={event.id} />
            <input type="hidden" name="slug" value={event.slug} />
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-bg/40 p-4 text-sm">
              <input
                type="checkbox"
                name="terms"
                className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                required
              />
              <span className="text-muted">
                I have read and agree to the ticket{" "}
                <Link
                  href="/legal/terms"
                  target="_blank"
                  className="text-accent underline-offset-2 hover:underline"
                >
                  terms &amp; conditions
                </Link>{" "}
                and{" "}
                <Link
                  href="/legal/code-of-conduct"
                  target="_blank"
                  className="text-accent underline-offset-2 hover:underline"
                >
                  code of conduct
                </Link>
                .
              </span>
            </label>
            <button className="btn btn-accent mt-5 w-full text-base">
              Confirm reservation
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-faint">
            Free entry · verified in-experience at the door
          </p>
        </div>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { partnerBySlug } from "@/lib/partners/registry";
import { getUserSession } from "@/lib/session";
import { activateTicket, cancelTicket } from "@/app/actions/tickets";
import { TicketReveal } from "@/components/ticket-reveal";
import { StatusBadge } from "@/components/ui";
import { dateBlock, formatDate, formatTime, isPast } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ticket" };

const statusLabel: Record<string, { key: any; text: string }> = {
  RESERVED: { key: "upcoming", text: "Reserved" },
  CHECKED_IN: { key: "open", text: "Checked in" },
  CANCELLED: { key: "closed", text: "Cancelled" },
};

export default async function PartnerTicketDetailPage({
  params,
  searchParams,
}: {
  params: { slug: string; code: string };
  searchParams: { activated?: string };
}) {
  const partner = partnerBySlug(params.slug);
  if (!partner) notFound();

  const session = await getUserSession();
  if (!session) redirect(`/account?returnTo=/tickets/${params.code}`);

  const ticket = await prisma.ticket.findUnique({
    where: { code: params.code },
    include: { event: true },
  });

  // Yours, AND for a show on this site. The second half matters: without it, an
  // RNL ticket code opens on the partner's host, rendering an RNL event in the
  // partner's brand. It is the visitor's own ticket either way — no data leaks —
  // but it belongs on the site whose show it admits them to.
  if (!ticket || ticket.userId !== session.uid) notFound();
  if (ticket.event.partnerId !== partner.slug) notFound();

  const { event } = ticket;
  const { day, month } = dateBlock(event.startsAt);
  const ended = isPast(event.startsAt);
  const cancelled = ticket.status === "CANCELLED";
  const activated = Boolean(ticket.activatedAt);
  const s = statusLabel[ticket.status];

  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-56" />

      <div className="shell relative pt-16 sm:pt-20">
        <Link href="/tickets" className="text-sm text-muted hover:text-fg">
          ← All tickets
        </Link>
        <p className="kicker mt-6 text-accent">Your ticket</p>
        <h1 className="display mt-5 text-4xl sm:text-5xl">{event.title}</h1>
      </div>

      <section className="shell grid gap-8 py-10 lg:grid-cols-[1fr_1fr]">
        {/* Details */}
        <div className="card p-6">
          <div className="flex items-center gap-4 border-b border-line pb-5">
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center border border-line bg-bg leading-none">
              <span className="display text-2xl">{day}</span>
              <span className="mt-1 text-[10px] font-bold tracking-widest text-accent">
                {month}
              </span>
            </div>
            <div>
              <StatusBadge status={s.key}>{s.text}</StatusBadge>
              <p className="display mt-2 text-xl leading-tight">
                {formatTime(event.startsAt)} · {formatDate(event.startsAt)}
              </p>
              {event.venue ? (
                <p className="text-sm text-muted">{event.venue}</p>
              ) : null}
            </div>
          </div>

          <dl className="mt-5 space-y-3 text-sm">
            <Row label="Ticket code" value={ticket.code} mono />
            <Row label="Holder" value={session.displayName} />
            <Row
              label="Terms accepted"
              value={
                ticket.termsAcceptedAt
                  ? formatDate(ticket.termsAcceptedAt)
                  : "—"
              }
            />
          </dl>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link
              href={`/events/${event.slug}`}
              className="text-sm text-muted hover:text-fg"
            >
              View show
            </Link>
            {!cancelled && !ended ? (
              <form action={cancelTicket}>
                <input type="hidden" name="ticketId" value={ticket.id} />
                <button className="text-sm text-faint hover:text-red-400">
                  Cancel ticket
                </button>
              </form>
            ) : null}
          </div>
        </div>

        {/* Activation / entry mark */}
        <div className="card grid place-items-center p-6 text-center">
          {cancelled ? (
            <p className="text-muted">This ticket has been cancelled.</p>
          ) : activated ? (
            // Fires the partner's confetti, not RNL's — the component reads the
            // preset off data-brand. See components/ticket-reveal.tsx.
            <TicketReveal
              code={ticket.code}
              justActivated={searchParams.activated === "1"}
            />
          ) : (
            <div className="flex max-w-xs flex-col items-center">
              <div className="grid h-[200px] w-[200px] place-items-center border border-dashed border-line bg-bg/40">
                <span className="text-sm text-faint">
                  Your entry mark is hidden until you activate.
                </span>
              </div>
              <p className="display mt-5 text-xl">Ready to go?</p>
              <p className="mt-1 text-sm text-muted">
                Activate your ticket to reveal your entry mark. Do this when
                you&apos;re heading in.
              </p>
              <form action={activateTicket} className="mt-5 w-full">
                <input type="hidden" name="ticketId" value={ticket.id} />
                <button className="btn btn-accent w-full text-base">
                  Activate ticket
                </button>
              </form>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line/60 pb-3">
      <dt className="text-faint">{label}</dt>
      <dd
        className={mono ? "font-mono font-semibold tracking-widest" : "text-fg"}
      >
        {value}
      </dd>
    </div>
  );
}

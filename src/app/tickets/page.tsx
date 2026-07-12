import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/session";
import { cancelTicket } from "@/app/actions/tickets";
import { TicketStub } from "@/components/ticket-stub";
import { Kicker } from "@/components/ui";
import { isPast } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My tickets" };

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: { new?: string };
}) {
  const session = await getUserSession();
  if (!session) redirect("/account?returnTo=/tickets");

  const tickets = await prisma.ticket.findMany({
    where: { userId: session.uid },
    include: { event: true },
    orderBy: { event: { startsAt: "asc" } },
  });

  const upcoming = tickets.filter(
    (t) => t.status !== "CANCELLED" && !isPast(t.event.startsAt),
  );
  const rest = tickets.filter(
    (t) => t.status === "CANCELLED" || isPast(t.event.startsAt),
  );

  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-56" />
      <div className="shell relative pt-16 sm:pt-20">
        <Kicker>Your account</Kicker>
        <h1 className="display mt-5 text-5xl sm:text-6xl">My tickets</h1>
        <p className="mt-4 text-muted">
          Signed in as{" "}
          <span className="font-semibold text-fg">{session.displayName}</span>.
          Show your ticket code at the door — it&apos;s verified in-experience.
        </p>
      </div>

      {searchParams.new ? (
        <div className="shell mt-8">
          <div className="flex flex-wrap items-center gap-3 rounded-[3px] border border-accent/40 bg-accent-soft px-5 py-4">
            <span className="rounded-[3px] bg-accent px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
              Confirmed
            </span>
            <p className="text-sm text-fg">
              You&apos;re in — ticket{" "}
              <span className="font-mono font-semibold">{searchParams.new}</span>{" "}
              is saved below.
            </p>
          </div>
        </div>
      ) : null}

      <section className="shell py-10">
        {tickets.length === 0 ? (
          <div className="card grid place-items-center px-6 py-20 text-center">
            <p className="font-display text-2xl">No tickets yet</p>
            <p className="mt-2 max-w-sm text-muted">
              Reserve your spot at an upcoming show and it&apos;ll show up here.
            </p>
            <Link href="/events" className="btn btn-accent mt-6">
              Browse events
            </Link>
          </div>
        ) : (
          <div className="space-y-10">
            {upcoming.length ? (
              <div>
                <h2 className="mb-5 font-display text-2xl">Upcoming</h2>
                <div className="grid gap-4">
                  {upcoming.map((t) => (
                    <div key={t.id} className="space-y-2">
                      <Link href={`/tickets/${t.code}`} className="block">
                        <TicketStub
                          code={t.code}
                          eventTitle={t.event.title}
                          startsAt={t.event.startsAt}
                          venue={t.event.venue}
                          status={t.status}
                          activated={Boolean(t.activatedAt)}
                        />
                      </Link>
                      <div className="flex items-center gap-4 px-1">
                        <Link
                          href={`/tickets/${t.code}`}
                          className="text-sm text-accent hover:text-fg"
                        >
                          Open ticket →
                        </Link>
                        <Link
                          href={`/events/${t.event.slug}`}
                          className="text-sm text-muted hover:text-fg"
                        >
                          View event
                        </Link>
                        <form action={cancelTicket}>
                          <input type="hidden" name="ticketId" value={t.id} />
                          <button className="text-sm text-faint hover:text-red-400">
                            Cancel ticket
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {rest.length ? (
              <div>
                <h2 className="mb-5 font-display text-2xl text-muted">
                  Past &amp; cancelled
                </h2>
                <div className="grid gap-4">
                  {rest.map((t) => (
                    <Link
                      key={t.id}
                      href={`/tickets/${t.code}`}
                      className="block"
                    >
                      <TicketStub
                        code={t.code}
                        eventTitle={t.event.title}
                        startsAt={t.event.startsAt}
                        venue={t.event.venue}
                        status={t.status}
                        activated={Boolean(t.activatedAt)}
                      />
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

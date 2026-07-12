import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AdminHeader, Badge, StatCard } from "@/components/admin-ui";
import { setTicketStatus } from "@/app/actions/admin";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AttendeesPage({
  params,
}: {
  params: { id: string };
}) {
  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: {
      tickets: { include: { user: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!event) notFound();

  const active = event.tickets.filter((t) => t.status !== "CANCELLED");
  const checkedIn = event.tickets.filter((t) => t.status === "CHECKED_IN");

  return (
    <div>
      <AdminHeader
        title="Attendees"
        subtitle={event.title}
        action={{ label: "Edit event", href: `/admin/events/${event.id}/edit` }}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Reserved" value={active.length} />
        <StatCard label="Checked in" value={checkedIn.length} />
        <StatCard
          label="Capacity"
          value={event.capacity > 0 ? event.capacity : "∞"}
        />
        <StatCard
          label="Remaining"
          value={event.capacity > 0 ? Math.max(0, event.capacity - active.length) : "∞"}
        />
      </div>

      {event.tickets.length ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-semibold">Attendee</th>
                  <th className="px-5 py-3 font-semibold">Ticket</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Reserved</th>
                  <th className="px-5 py-3 text-right font-semibold">Door</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {event.tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-4">
                      <p className="font-medium">{t.user.displayName}</p>
                      <p className="text-xs text-muted">
                        @{t.user.username} · ID {t.user.robloxId}
                      </p>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs">{t.code}</td>
                    <td className="px-5 py-4">
                      <Badge value={t.status} />
                    </td>
                    <td className="px-5 py-4 text-muted">
                      {formatDateTime(t.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {t.status === "RESERVED" && (
                          <StatusForm
                            ticketId={t.id}
                            eventId={event.id}
                            to="CHECKED_IN"
                            label="Check in"
                            variant="accent"
                          />
                        )}
                        {t.status === "CHECKED_IN" && (
                          <StatusForm
                            ticketId={t.id}
                            eventId={event.id}
                            to="RESERVED"
                            label="Undo"
                          />
                        )}
                        {t.status !== "CANCELLED" ? (
                          <StatusForm
                            ticketId={t.id}
                            eventId={event.id}
                            to="CANCELLED"
                            label="Cancel"
                            variant="danger"
                          />
                        ) : (
                          <StatusForm
                            ticketId={t.id}
                            eventId={event.id}
                            to="RESERVED"
                            label="Restore"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card grid place-items-center px-6 py-20 text-center">
          <p className="font-display text-2xl">No tickets reserved yet</p>
          <p className="mt-2 text-muted">
            Share the event to get the first reservations in.
          </p>
          <Link href={`/events/${event.slug}`} className="btn btn-ghost mt-5">
            View public page
          </Link>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-line bg-elev p-5 text-sm text-muted">
        <p>
          <span className="font-semibold text-fg">In-game check-in:</span> your
          Roblox entry system can verify and check in these tickets automatically
          via the API. See{" "}
          <Link href="/admin/settings" className="text-accent">
            Settings → In-game API
          </Link>
          . This event&apos;s ID is{" "}
          <code className="font-mono text-fg">{event.id}</code>.
        </p>
      </div>
    </div>
  );
}

function StatusForm({
  ticketId,
  eventId,
  to,
  label,
  variant,
}: {
  ticketId: string;
  eventId: string;
  to: string;
  label: string;
  variant?: "accent" | "danger";
}) {
  const cls =
    variant === "accent"
      ? "rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
      : variant === "danger"
        ? "rounded-lg border border-line px-3 py-1.5 text-xs text-faint hover:border-red-500/40 hover:text-red-400"
        : "rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:text-fg";
  return (
    <form action={setTicketStatus}>
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="status" value={to} />
      <button className={cls}>{label}</button>
    </form>
  );
}

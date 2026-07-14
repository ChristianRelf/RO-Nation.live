import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AdminHeader, Badge, StatCard } from "@/components/admin-ui";
import { liftTicketRevocation, setTicketStatus } from "@/app/actions/company";
import { formatDateTime } from "@/lib/format";
import { formatRobux } from "@/lib/tickets/pricing";
import { requireCompanyUser } from "@/lib/company";

export const dynamic = "force-dynamic";

export default async function AttendeesPage({
  params,
}: {
  params: { id: string };
}) {
  await requireCompanyUser();

  // findFirst with partnerId: null, NOT findUnique on the id alone.
  //
  // It was findUnique, which is a scope leak of exactly the kind this codebase warns about
  // everywhere else: an event id is opaque but not secret, and pasting a partner's into
  // this URL rendered THEIR attendee list - every holder's display name, username and
  // Roblox id - inside RNL's dashboard. The writes on this page were already scoped
  // (setTicketStatus matches `event: { partnerId: null }`), so the buttons all refused;
  // the page just showed you the data first. updateEvent puts it best: "passing one guard
  // is not the same as being allowed to touch the row."
  const event = await prisma.event.findFirst({
    where: { id: params.id, partnerId: null },
    include: {
      tickets: { include: { user: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!event) notFound();

  const active = event.tickets.filter((t) => t.status !== "CANCELLED");
  const checkedIn = event.tickets.filter((t) => t.status === "CHECKED_IN");

  // Live tickets per tier, by the name frozen ON the ticket - so a tier that has
  // since been renamed or deleted still shows the people who bought it, under
  // the name they bought it under.
  const byTier = new Map<string, number>();
  for (const t of active) {
    const name = t.tierName ?? "General Admission";
    byTier.set(name, (byTier.get(name) ?? 0) + 1);
  }

  return (
    <div>
      <AdminHeader
        title="Attendees"
        subtitle={event.title}
        action={{ label: "Edit event", href: `/company/events/${event.id}/edit` }}
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

      {byTier.size > 1 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {[...byTier.entries()].map(([name, n]) => (
            <span
              key={name}
              className="rounded-lg border border-line bg-elev px-3 py-1.5 text-xs text-muted"
            >
              {name} <span className="ml-1 font-semibold text-fg">{n}</span>
            </span>
          ))}
        </div>
      ) : null}

      {event.tickets.length ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-semibold">Attendee</th>
                  <th className="px-5 py-3 font-semibold">Ticket</th>
                  <th className="px-5 py-3 font-semibold">Admission</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Reserved</th>
                  <th className="px-5 py-3 text-right font-semibold">Door</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {event.tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-fg/[0.02]">
                    <td className="px-5 py-4">
                      <p className="font-medium">{t.user.displayName}</p>
                      <p className="text-xs text-muted">
                        @{t.user.username} · ID {t.user.robloxId}
                      </p>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs">{t.code}</td>
                    <td className="px-5 py-4">
                      <p>{t.tierName ?? "General Admission"}</p>
                      <p className="text-xs text-faint">
                        {t.priceRobux > 0 ? formatRobux(t.priceRobux) : "Free"}
                      </p>
                    </td>
                    {/* CANCELLED alone cannot say WHICH of the two things happened.
                        Voiding is an undo - wrong person, duplicate, change of plan - and
                        the holder may reserve again. Revoking is a BAN: the reason they
                        may not have a ticket is the person, not the ticket. The schema
                        spends twenty lines distinguishing them and this table rendered
                        both as the same grey pill, with no reason, no author, and no way
                        to tell them apart. */}
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge value={t.status} />
                        {t.revokedAt ? <Badge value="REVOKED" /> : null}
                      </div>
                      {t.revokedAt ? (
                        <p className="mt-1.5 max-w-[16rem] text-xs text-red-300/80">
                          {t.revokedReason || "No reason recorded"}
                          {t.revokedByName ? (
                            <span className="text-faint"> · {t.revokedByName}</span>
                          ) : null}
                        </p>
                      ) : null}
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

                        {/* Three states, three buttons - and the banned one is NOT
                            "Restore".

                            Restore sets status = RESERVED and leaves revokedAt stamped:
                            a ticket that is live and revoked at the same time, which is a
                            state nobody chose and nothing else in the system expects.
                            Lifting a ban and handing back a seat are two different acts,
                            so they are two different buttons. Lift the ban first, then
                            Restore appears. */}
                        {t.revokedAt ? (
                          <form action={liftTicketRevocation}>
                            <input type="hidden" name="ticketId" value={t.id} />
                            <input type="hidden" name="eventId" value={event.id} />
                            <button
                              title="They can reserve for this show again. The ticket stays cancelled."
                              className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:border-red-400 hover:text-red-200"
                            >
                              Lift ban
                            </button>
                          </form>
                        ) : t.status !== "CANCELLED" ? (
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
          <Link href="/company/settings" className="text-accent">
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
      ? "rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90"
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

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AdminHeader, Badge } from "@/components/admin-ui";
import {
  liftTicketRevocation,
  setTicketStatus,
  updateTicket,
  voidCompanyTicket,
} from "@/app/actions/company";
import { LocalTime } from "@/components/local-time";
import { effectiveTiers, priceLabel } from "@/lib/tickets/pricing";
import { requireCompanyUser } from "@/lib/company";

export const dynamic = "force-dynamic";

// One ticket, and the three things you can do to it: look at it, move it, take it away.
//
// The page exists because the attendees table cannot be the place where a ticket is edited.
// A row in a list has room for a status pill and two buttons; it has no room for the reason
// a ban was issued, the payments that landed against the row, or a tier picker that has to
// say what will happen to the holder when you use it. Cramming that into a table cell is how
// you get a destructive button next to a benign one at 12px.

const ERRORS: Record<string, string> = {
  tier: "That tier doesn't belong to this show, so nothing was changed.",
  checked_in:
    "They're already checked in - they're in the room, and cancelling the record would only make it lie. If they shouldn't be there, that's a door problem, not a database one.",
  not_found: "That ticket no longer exists.",
};

const OK: Record<string, string> = {
  updated: "Moved. The holder gets a notice on their next visit.",
  upgraded: "Upgraded. The holder gets the good news on their next visit.",
  voided: "Voided. Any seat it held is back in the room, and the holder has been told.",
  banned:
    "Voided and banned from this show. They cannot reserve another until the ban is lifted.",
};

export default async function CompanyTicketPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ok?: string; error?: string };
}) {
  await requireCompanyUser();

  // findFirst with partnerId: null on the event, NOT findUnique on the ticket id.
  //
  // Same leak, same shape, same reason as the attendees page: a ticket id is opaque but not
  // secret, and the writes refusing a partner's row is not the same as the page declining to
  // render it. The scope travels through the event, because that is where a ticket's org
  // actually lives.
  const ticket = await prisma.ticket.findFirst({
    where: { id: params.id, event: { partnerId: null } },
    include: {
      user: true,
      event: { include: { tiers: true } },
      purchases: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!ticket) notFound();

  const { event, user } = ticket;

  // Ordered worst-to-best by the event's own reckoning (sortOrder, then price) - the same
  // order the member saw at the checkout, and the same order diffTicketChange ranks against
  // to decide whether a move is an upgrade. The picker and the notice must not disagree
  // about which way is up, and the only way two things cannot disagree is if they read the
  // same list.
  const tiers = effectiveTiers(event.tiers).filter(
    (t): t is typeof t & { id: string } => t.id !== null,
  );
  const currentIndex = tiers.findIndex((t) => t.id === ticket.tierId);
  const orphaned = ticket.tierId === null || currentIndex === -1;
  const seated = Boolean(ticket.seatKey || ticket.sectionKey);

  return (
    <div>
      <AdminHeader
        title={ticket.code}
        subtitle={`${user.displayName} · ${event.title}`}
        action={{
          label: "Back to tickets",
          href: "/company/tickets",
        }}
      />

      {searchParams.ok ? (
        <p className="mb-6 border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300">
          {OK[searchParams.ok] ?? "Saved."}
        </p>
      ) : null}
      {searchParams.error ? (
        <p className="mb-6 border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {ERRORS[searchParams.error] ?? "That didn't work."}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {/* ---- Move them ------------------------------------------------ */}
          <section className="card p-6">
            <h2 className="font-display text-2xl">Admission</h2>
            <p className="mt-1 text-sm text-muted">
              What this ticket is. Changing it re-writes the name and price frozen onto the
              ticket, because what they hold is now a different thing.
            </p>

            {tiers.length === 0 ? (
              <p className="mt-5 rounded-lg border border-line bg-elev p-4 text-sm text-muted">
                This show has no tiers, so every ticket on it is the implicit free general
                admission and there is nothing to move between. Add tiers on the{" "}
                <Link href={`/company/events/${event.id}/edit`} className="text-accent">
                  event editor
                </Link>{" "}
                first.
              </p>
            ) : (
              <form action={updateTicket} className="mt-5 space-y-4">
                <input type="hidden" name="ticketId" value={ticket.id} />

                <select
                  name="tierId"
                  defaultValue={orphaned ? "" : ticket.tierId!}
                  className="w-full rounded-lg border border-line bg-elev px-3 py-2.5 text-sm text-fg"
                >
                  {/* A ticket whose tier was DELETED out from under it (tierId is SetNull)
                      still names what they bought, and that name is not in this list. Without
                      this option the select would silently preselect the first tier and read
                      as though they already held it - so the picker would be lying about the
                      present before anybody touched it. */}
                  {orphaned ? (
                    <option value="" disabled>
                      {ticket.tierName ?? "General Admission"} - no longer offered
                    </option>
                  ) : null}
                  {tiers.map((t, i) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {priceLabel(t.priceRobux)}
                      {i === currentIndex ? " (current)" : ""}
                    </option>
                  ))}
                </select>

                {/* The honest version of "this sends an email". Staff should know before they
                    click that this talks to a member, and which of the two things it says. */}
                <p className="text-xs text-faint">
                  Moving them <span className="text-muted">up</span> this list tells them
                  they&apos;ve been upgraded, and says so with some enthusiasm. Any other move
                  gets the plain &ldquo;your ticket has changed&rdquo; notice. Re-picking the
                  tier they already hold says nothing to anybody.
                </p>

                {seated ? (
                  <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
                    <span className="font-semibold">They&apos;re sitting in {ticket.seatLabel}.</span>{" "}
                    Changing the tier leaves them in that chair - a seat move is the{" "}
                    <Link href={`/company/events/${event.id}/venue`} className="underline">
                      venue map&apos;s
                    </Link>{" "}
                    job, not this form&apos;s. If the new tier lives in a different block,
                    move them there too.
                  </p>
                ) : null}

                <button className="btn btn-accent" disabled={tiers.length === 0}>
                  Save admission
                </button>
              </form>
            )}
          </section>

          {/* ---- Take it away --------------------------------------------- */}
          <section className="card p-6">
            <h2 className="font-display text-2xl">Void</h2>

            {ticket.status === "CHECKED_IN" ? (
              <p className="mt-3 rounded-lg border border-line bg-elev p-4 text-sm text-muted">
                They&apos;re checked in. A ticket cannot be voided once its holder is in the
                room - cancelling it would not get them out, and it would leave the
                door&apos;s own record saying somebody who never came in did.
              </p>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted">
                  Voiding is the undo: wrong person, duplicate, change of plan. The ticket is
                  cancelled, its seat goes back into the room, and they may reserve again.
                  Banning is a statement about the person - it cancels the ticket and refuses
                  them another for this show.
                </p>

                <form action={voidCompanyTicket} className="mt-5 space-y-4">
                  <input type="hidden" name="ticketId" value={ticket.id} />

                  <label className="flex items-start gap-3 rounded-lg border border-line bg-elev p-3">
                    <input
                      type="checkbox"
                      name="ban"
                      value="true"
                      className="mt-0.5 accent-red-500"
                    />
                    <span className="text-sm">
                      <span className="font-semibold text-fg">
                        Ban them from this show too
                      </span>
                      <span className="block text-xs text-muted">
                        They will not be able to reserve another ticket for it. This bans them
                        from this show only - a standing ban across every show is the{" "}
                        <Link href="/shasha/blacklist" className="text-accent">
                          blacklist
                        </Link>
                        .
                      </span>
                    </span>
                  </label>

                  <div>
                    <label
                      htmlFor="reason"
                      className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted"
                    >
                      Reason
                    </label>
                    <input
                      id="reason"
                      name="reason"
                      maxLength={300}
                      placeholder="Why - recorded against the ban, shown to staff"
                      className="w-full rounded-lg border border-line bg-elev px-3 py-2.5 text-sm text-fg placeholder:text-faint"
                    />
                    <p className="mt-1.5 text-xs text-faint">
                      Only recorded on a ban. The holder never sees it; the crew does.
                    </p>
                  </div>

                  <button className="rounded-lg border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-300 transition-colors hover:border-red-400 hover:bg-red-500/10 hover:text-red-200">
                    {ticket.status === "CANCELLED"
                      ? "Apply to cancelled ticket"
                      : "Void this ticket"}
                  </button>
                  {ticket.status === "CANCELLED" ? (
                    <p className="text-xs text-faint">
                      Already cancelled. Submitting with the box ticked upgrades the void into
                      a ban; the holder is not told twice.
                    </p>
                  ) : null}
                </form>
              </>
            )}
          </section>

          {/* ---- Payments -------------------------------------------------- */}
          {ticket.purchases.length ? (
            <section className="card p-6">
              <h2 className="font-display text-2xl">Payments</h2>
              <p className="mt-1 text-sm text-muted">
                What Roblox reported, as reported. More than one is normal - an upgrade bought
                inside the experience is a second payment against the same ticket.
              </p>
              <ul className="mt-4 divide-y divide-line text-sm">
                {ticket.purchases.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">{priceLabel(p.robuxSpent)}</p>
                      <p className="truncate font-mono text-xs text-faint">
                        {p.purchaseId}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-muted">
                      <LocalTime value={p.createdAt} mode="datetime" />
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {/* ---- The facts -------------------------------------------------- */}
        <aside className="space-y-6">
          <section className="card p-5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge value={ticket.status} />
              {ticket.revokedAt ? <Badge value="REVOKED" /> : null}
            </div>

            {ticket.revokedAt ? (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-300">
                  Banned from this show
                </p>
                <p className="mt-1 text-sm text-red-200/90">
                  {ticket.revokedReason || "No reason recorded"}
                </p>
                <p className="mt-1 text-xs text-red-300/60">
                  {ticket.revokedByName ?? "Unknown"} ·{" "}
                  <LocalTime value={ticket.revokedAt} mode="datetime" />
                </p>

                {/* Lifting the ban and handing the ticket back are two different acts, so
                    they are two different buttons - the same rule the attendees page follows.
                    This one restores their RIGHT to reserve; it does not re-seat them at a
                    show that may well have sold out since. */}
                <form action={liftTicketRevocation} className="mt-3">
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <input type="hidden" name="eventId" value={event.id} />
                  <button className="w-full rounded-lg border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-300 transition-colors hover:border-red-400 hover:text-red-200">
                    Lift the ban
                  </button>
                </form>
                <p className="mt-1.5 text-[11px] text-red-300/50">
                  The ticket stays cancelled. They may reserve a new one.
                </p>
              </div>
            ) : null}

            <dl className="mt-5 space-y-3 text-sm">
              <Fact label="Holder">
                <p>{user.displayName}</p>
                <p className="text-xs text-muted">
                  @{user.username} · ID {user.robloxId}
                </p>
              </Fact>
              <Fact label="Show">
                <Link
                  href={`/company/events/${event.id}/attendees`}
                  className="text-accent"
                >
                  {event.title}
                </Link>
                <p className="text-xs text-muted">
                  <LocalTime value={event.startsAt} mode="datetime" />
                </p>
              </Fact>
              <Fact label="Admission">
                <p>{ticket.tierName ?? "General Admission"}</p>
                <p className="text-xs text-muted">{priceLabel(ticket.priceRobux)}</p>
              </Fact>
              {ticket.seatLabel ? (
                <Fact label="Seat">
                  <p>{ticket.seatLabel}</p>
                  {!ticket.seatKey ? (
                    // seatLabel is frozen and survives cancellation; seatKey is the chair
                    // itself and is nulled to free it. Both being shown as "their seat" would
                    // be a lie about a chair somebody else may now be sitting in.
                    <p className="text-xs text-faint">
                      Released - the chair is back in the room.
                    </p>
                  ) : null}
                </Fact>
              ) : null}
              <Fact label="Reserved">
                <p>
                  <LocalTime value={ticket.createdAt} mode="datetime" />
                </p>
              </Fact>
              {ticket.issuedByName ? (
                <Fact label="Issued by">
                  <p>{ticket.issuedByName}</p>
                  <p className="text-xs text-faint">
                    Audit only - grants nothing, never read at the door.
                  </p>
                </Fact>
              ) : null}
              {ticket.checkedInAt ? (
                <Fact label="Checked in">
                  <p>
                    <LocalTime value={ticket.checkedInAt} mode="datetime" />
                  </p>
                </Fact>
              ) : null}
              <Fact label="Activated">
                <p className="text-muted">
                  {ticket.activatedAt ? (
                    <LocalTime value={ticket.activatedAt} mode="datetime" />
                  ) : (
                    "Not yet - the code is still sealed"
                  )}
                </p>
              </Fact>
            </dl>
          </section>

          <section className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Door
            </p>
            <div className="mt-3 space-y-2">
              {ticket.status === "RESERVED" ? (
                <StatusForm
                  ticketId={ticket.id}
                  eventId={event.id}
                  to="CHECKED_IN"
                  label="Check in"
                  accent
                />
              ) : null}
              {ticket.status === "CHECKED_IN" ? (
                <StatusForm
                  ticketId={ticket.id}
                  eventId={event.id}
                  to="RESERVED"
                  label="Undo check-in"
                />
              ) : null}
              {ticket.status === "CANCELLED" && !ticket.revokedAt ? (
                <StatusForm
                  ticketId={ticket.id}
                  eventId={event.id}
                  to="RESERVED"
                  label="Restore ticket"
                />
              ) : null}
              {ticket.status === "CANCELLED" && ticket.revokedAt ? (
                <p className="text-xs text-faint">
                  Lift the ban before restoring. A ticket that is live and revoked at once is
                  a state nothing else in the system expects.
                </p>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-faint">
        {label}
      </dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function StatusForm({
  ticketId,
  eventId,
  to,
  label,
  accent,
}: {
  ticketId: string;
  eventId: string;
  to: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <form action={setTicketStatus}>
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="status" value={to} />
      <button
        className={
          accent
            ? "w-full rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-ink hover:opacity-90"
            : "w-full rounded-lg border border-line px-3 py-2 text-xs text-muted transition-colors hover:text-fg"
        }
      >
        {label}
      </button>
    </form>
  );
}

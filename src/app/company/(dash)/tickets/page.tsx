import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AdminHeader, Badge, StatCard } from "@/components/admin-ui";
import { formatDateTime } from "@/lib/format";
import { priceLabel } from "@/lib/tickets/pricing";
import { requireCompanyUser } from "@/lib/company";

export const dynamic = "force-dynamic";

// Every ticket RNL has issued, across every one of its shows.
//
// A different question from /company/events/<id>/attendees, which is why it is a different
// page rather than a filter on that one. The attendees list answers "who is coming to this
// show" and is read down a column. This answers "where is THIS person's ticket" - the
// question you actually arrive with when somebody messages you a code, and one that used to
// have no answer at all short of guessing which of forty shows they meant.
//
// Scope: `event: { partnerId: null }` on the count, the list and the filter's own event
// options. A Ticket row has no partnerId of its own - a ticket's org lives on its EVENT - so
// the scope travels through the relation on every query here. Miss it once and this page
// lists a partner's ticket-holders inside RNL's dashboard, which is the exact leak the
// attendees page shipped with.

const PAGE_SIZE = 100;

const STATUS_OPTIONS = [
  { value: "", label: "Any status" },
  { value: "RESERVED", label: "Reserved" },
  { value: "CHECKED_IN", label: "Checked in" },
  { value: "CANCELLED", label: "Cancelled" },
  // Not a TicketStatus - a revoked ticket IS cancelled, plus a stamp. It is here because
  // "show me everyone banned from a show" is a question staff ask and the enum cannot.
  { value: "REVOKED", label: "Revoked (banned)" },
];

const OK: Record<string, string> = {
  updated: "Ticket updated. The holder has been told.",
  upgraded: "Upgraded. The holder gets the good news on their next visit.",
  voided: "Ticket voided. The seat, if it held one, is back in the room.",
  banned: "Ticket voided and the holder banned from this show.",
};

export default async function CompanyTicketsPage({
  searchParams,
}: {
  searchParams: {
    event?: string;
    status?: string;
    q?: string;
    page?: string;
    ok?: string;
  };
}) {
  await requireCompanyUser();

  const q = (searchParams.q ?? "").trim();
  const status = searchParams.status ?? "";
  const eventId = searchParams.event ?? "";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);

  const where: Prisma.TicketWhereInput = {
    event: { partnerId: null },
    ...(eventId ? { eventId } : {}),
    ...(status === "REVOKED"
      ? { revokedAt: { not: null } }
      : status
        ? { status: status as "RESERVED" | "CHECKED_IN" | "CANCELLED" }
        : {}),
    // Everything somebody might paste into the box. The code is the common one, but a
    // support message just as often carries a username or the profile id, and typing a
    // display name should not be the one thing that finds nothing.
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" as const } },
            { user: { username: { contains: q, mode: "insensitive" as const } } },
            {
              user: {
                displayName: { contains: q, mode: "insensitive" as const },
              },
            },
            { user: { robloxId: { contains: q } } },
          ],
        }
      : {}),
  };

  const [events, total, live, checkedIn, tickets] = await Promise.all([
    prisma.event.findMany({
      where: { partnerId: null },
      select: { id: true, title: true },
      orderBy: { startsAt: "desc" },
    }),
    prisma.ticket.count({ where }),
    prisma.ticket.count({ where: { ...where, status: { not: "CANCELLED" } } }),
    prisma.ticket.count({ where: { ...where, status: "CHECKED_IN" } }),
    prisma.ticket.findMany({
      where,
      include: {
        user: {
          select: { displayName: true, username: true, robloxId: true },
        },
        event: { select: { id: true, title: true, startsAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(q || status || eventId);

  // Carried through the pager so paging never silently drops the filter you are looking at.
  const qs = (next: number) => {
    const p = new URLSearchParams();
    if (eventId) p.set("event", eventId);
    if (status) p.set("status", status);
    if (q) p.set("q", q);
    if (next > 1) p.set("page", String(next));
    const str = p.toString();
    return str ? `/company/tickets?${str}` : "/company/tickets";
  };

  return (
    <div>
      <AdminHeader
        title="Tickets"
        subtitle="Every ticket across every RNL show. Search by code, name or Roblox ID."
      />

      {searchParams.ok ? (
        <p className="mb-6 border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300">
          {OK[searchParams.ok] ?? "Saved."}
        </p>
      ) : null}

      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatCard
          label={filtered ? "Matching" : "Issued"}
          value={total.toLocaleString("en-GB")}
        />
        <StatCard label="Live" value={live.toLocaleString("en-GB")} hint="Not cancelled" />
        <StatCard label="Checked in" value={checkedIn.toLocaleString("en-GB")} />
      </div>

      {/* A plain GET form. No client state, no submit-on-change: the filter is in the URL,
          which means a staff member can send "every revoked ticket on Neon Nights" to a
          colleague as a link, and the back button does what a back button should. */}
      <form method="get" className="card mb-6 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto]">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Code, username, display name or Roblox ID"
          className="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-fg placeholder:text-faint"
        />
        <select
          name="event"
          defaultValue={eventId}
          className="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-fg"
        >
          <option value="">Every show</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status}
          className="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-fg"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button className="btn btn-accent">Filter</button>
      </form>

      {tickets.length ? (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-5 py-3 font-semibold">Holder</th>
                    <th className="px-5 py-3 font-semibold">Ticket</th>
                    <th className="px-5 py-3 font-semibold">Show</th>
                    <th className="px-5 py-3 font-semibold">Admission</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 text-right font-semibold" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-fg/[0.02]">
                      <td className="px-5 py-4">
                        <p className="font-medium">{t.user.displayName}</p>
                        <p className="text-xs text-muted">
                          @{t.user.username} · ID {t.user.robloxId}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-mono text-xs">{t.code}</p>
                        <p className="mt-0.5 text-xs text-faint">
                          {formatDateTime(t.createdAt)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="max-w-[14rem] truncate">{t.event.title}</p>
                        <p className="text-xs text-faint">
                          {formatDateTime(t.event.startsAt)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p>{t.tierName ?? "General Admission"}</p>
                        <p className="text-xs text-faint">
                          {priceLabel(t.priceRobux)}
                          {t.seatLabel ? ` · ${t.seatLabel}` : ""}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge value={t.status} />
                          {t.revokedAt ? <Badge value="REVOKED" /> : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/company/tickets/${t.id}`}
                          className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:text-fg"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Said out loud, always - not only when there is a next page. A list that quietly
              stops at 100 reads as "that is all of them", and acting on that belief is how
              somebody concludes a ticket does not exist. */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
            <p>
              Showing{" "}
              <span className="text-fg">
                {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, total)}
              </span>{" "}
              of {total.toLocaleString("en-GB")}
            </p>
            {pages > 1 ? (
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Link href={qs(page - 1)} className="btn btn-ghost px-3 py-1.5 text-xs">
                    ← Previous
                  </Link>
                ) : null}
                <span className="text-xs text-faint">
                  Page {page} of {pages}
                </span>
                {page < pages ? (
                  <Link href={qs(page + 1)} className="btn btn-ghost px-3 py-1.5 text-xs">
                    Next →
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <div className="card grid place-items-center px-6 py-20 text-center">
          <p className="font-display text-2xl">
            {filtered ? "Nothing matches" : "No tickets issued yet"}
          </p>
          <p className="mt-2 max-w-md text-muted">
            {filtered
              ? "No ticket on an RNL show matches that. Check the code, or widen the filter."
              : "Tickets appear here the moment somebody reserves one on any RNL show."}
          </p>
          {filtered ? (
            <Link href="/company/tickets" className="btn btn-ghost mt-5">
              Clear the filter
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}

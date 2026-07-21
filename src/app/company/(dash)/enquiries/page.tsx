import Link from "next/link";
import { prisma } from "@/lib/db";
import { AdminHeader, Badge } from "@/components/admin-ui";
import { ConfirmButton } from "@/components/confirm-button";
import {
  deleteEnquiry,
  setEnquiryNote,
  setEnquiryStatus,
} from "@/app/actions/company";
import { requireCompanyUser } from "@/lib/company";
import { LocalTime } from "@/components/local-time";
import { robloxProfileUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Everyone who has written in.
//
// Built as a near-copy of the applications inbox, deliberately: it is the same object -
// a queue of messages from outside that somebody has to triage - and two screens that do
// the same job should look and behave the same way.
//
// Every row here came from a SIGNED-IN Roblox account (see actions/enquiries.ts for why),
// so the sender is a real, checkable person rather than a string in a form.

const STATUSES = ["NEW", "READING", "REPLIED", "CLOSED"] as const;
// DATA is here so a privacy request gets its own filter pill - those carry statutory
// deadlines and want triaging apart from a booking. Kept last so the everyday kinds
// stay first in the row. See actions/data-requests.ts.
const KINDS = ["BOOKING", "PRESS", "PARTNERSHIP", "GENERAL", "DATA"] as const;

type Kind = (typeof KINDS)[number];
type Status = (typeof STATUSES)[number];

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: { kind?: string; status?: string };
}) {
  await requireCompanyUser();

  const kind = KINDS.includes(searchParams.kind as Kind)
    ? (searchParams.kind as Kind)
    : null;
  const status = STATUSES.includes(searchParams.status as Status)
    ? (searchParams.status as Status)
    : null;

  const [enquiries, open] = await Promise.all([
    prisma.enquiry.findMany({
      where: {
        ...(kind ? { kind } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { user: true },
    }),
    prisma.enquiry.count({ where: { status: { in: ["NEW", "READING"] } } }),
  ]);

  const qs = (next: { kind?: string | null; status?: string | null }) => {
    const params = new URLSearchParams();
    const k = next.kind === undefined ? kind : next.kind;
    const st = next.status === undefined ? status : next.status;
    if (k) params.set("kind", k);
    if (st) params.set("status", st);
    const q = params.toString();
    return `/company/enquiries${q ? `?${q}` : ""}`;
  };

  return (
    <div>
      <AdminHeader
        title="Enquiries"
        subtitle={
          open
            ? `${open} still waiting on you.`
            : "Bookings, press and partnerships from the contact form."
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Pill label="All" href={qs({ kind: null })} active={!kind} />
        {KINDS.map((k) => (
          <Pill
            key={k}
            label={k[0] + k.slice(1).toLowerCase()}
            href={qs({ kind: k })}
            active={kind === k}
          />
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Pill label="Any status" href={qs({ status: null })} active={!status} />
        {STATUSES.map((st) => (
          <Pill
            key={st}
            label={st[0] + st.slice(1).toLowerCase()}
            href={qs({ status: st })}
            active={status === st}
          />
        ))}
      </div>

      {enquiries.length ? (
        <div className="space-y-4">
          {enquiries.map((e) => (
            <div key={e.id} className="card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-xl">{e.subject}</h3>
                    <Badge value={e.kind} />
                    <Badge value={e.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {e.name} · <LocalTime value={e.createdAt} mode="datetime" />
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.map((st) => (
                    <form action={setEnquiryStatus} key={st}>
                      <input type="hidden" name="id" value={e.id} />
                      <input type="hidden" name="status" value={st} />
                      <button
                        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                          e.status === st
                            ? "border-accent bg-accent-soft text-accent"
                            : "border-line text-muted hover:text-fg"
                        }`}
                      >
                        {st[0] + st.slice(1).toLowerCase()}
                      </button>
                    </form>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-4">
                <Meta label="Email" value={e.email} mailto />
                <Meta label="Discord" value={e.discord} />
                <Meta label="When" value={e.eventDate} />
                <Meta label="Scale" value={e.scale} />
              </div>

              {/* Who they actually are. The form requires a Roblox sign-in, so this is
                  never a name somebody typed - it is an account you can open. */}
              {e.user ? (
                <p className="mt-3 text-xs text-faint">
                  Signed in as{" "}
                  <a
                    href={robloxProfileUrl(e.user.robloxId)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-muted hover:text-accent"
                  >
                    @{e.user.username} · {e.user.robloxId} ↗
                  </a>
                </p>
              ) : null}

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                  Message
                </p>
                <p className="mt-1.5 whitespace-pre-line text-muted">{e.message}</p>
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4">
                <form action={setEnquiryNote} className="flex flex-1 items-end gap-3">
                  <input type="hidden" name="id" value={e.id} />
                  <div className="min-w-[14rem] flex-1">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-faint">
                      Crew note
                    </label>
                    <input
                      name="note"
                      defaultValue={e.note ?? ""}
                      maxLength={4000}
                      placeholder="Never shown to them."
                      className="w-full border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                  </div>
                  <button className="btn btn-ghost !px-4 !py-2 text-xs">Save</button>
                </form>

                <form action={deleteEnquiry} className="pb-2">
                  <input type="hidden" name="id" value={e.id} />
                  <ConfirmButton
                    className="text-xs text-faint hover:text-red-400"
                    message={`Delete "${e.subject}"? There is no undo.`}
                  >
                    Delete
                  </ConfirmButton>
                </form>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card grid place-items-center px-6 py-20 text-center">
          <p className="font-display text-2xl">Nothing in the inbox</p>
          <p className="mt-2 max-w-md text-muted">
            {kind || status
              ? "Nothing matches that filter."
              : "Bookings and press enquiries land here. Every 'work with us' button used to just point at Discord."}
          </p>
          <Link href="/contact" className="btn btn-ghost mt-6">
            See the form ↗
          </Link>
        </div>
      )}
    </div>
  );
}

function Pill({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-line text-muted hover:text-fg"
      }`}
    >
      {label}
    </Link>
  );
}

function Meta({
  label,
  value,
  mailto,
}: {
  label: string;
  value: string | null;
  mailto?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-faint">
        {label}
      </p>
      {value ? (
        mailto ? (
          <a href={`mailto:${value}`} className="break-all text-accent hover:underline">
            {value}
          </a>
        ) : (
          <p className="break-words text-fg">{value}</p>
        )
      ) : (
        <p className="text-faint">-</p>
      )}
    </div>
  );
}

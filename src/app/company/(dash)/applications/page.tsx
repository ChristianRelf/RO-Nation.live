import Link from "next/link";
import { prisma } from "@/lib/db";
import { AdminHeader, Badge } from "@/components/admin-ui";
import { setApplicationStatus } from "@/app/actions/company";
import { formatDateTime } from "@/lib/format";
import { requireCompanyUser } from "@/lib/company";

export const dynamic = "force-dynamic";

const STATUSES = ["NEW", "REVIEWING", "ACCEPTED", "REJECTED"] as const;

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: { career?: string; status?: string };
}) {
  await requireCompanyUser();
  // partnerId: null pins this inbox to RNL's own roles. Without it, pasting a
  // partner's career id into ?career= would list their applicants here.
  const where = {
    partnerId: null,
    ...(searchParams.career ? { careerId: searchParams.career } : {}),
    ...(searchParams.status &&
    STATUSES.includes(searchParams.status as (typeof STATUSES)[number])
      ? { status: searchParams.status as (typeof STATUSES)[number] }
      : {}),
  };

  const [applications, careers] = await Promise.all([
    prisma.application.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { career: true, user: true },
    }),
    prisma.career.findMany({
      where: { partnerId: null },
      orderBy: { title: "asc" },
    }),
  ]);

  const activeCareer = searchParams.career
    ? careers.find((c) => c.id === searchParams.career)
    : null;

  return (
    <div>
      <AdminHeader
        title="Applications"
        subtitle={
          activeCareer
            ? `Filtered to ${activeCareer.title}`
            : "Everyone who's applied to join the crew."
        }
      />

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <FilterLink label="All roles" href="/company/applications" active={!searchParams.career} />
        {careers.map((c) => (
          <FilterLink
            key={c.id}
            label={c.title}
            href={`/company/applications?career=${c.id}`}
            active={searchParams.career === c.id}
          />
        ))}
      </div>

      {applications.length ? (
        <div className="space-y-4">
          {applications.map((a) => (
            <div key={a.id} className="card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-xl">{a.robloxUsername}</h3>
                    <Badge value={a.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    Applied for{" "}
                    <Link
                      href={`/careers/${a.career.slug}`}
                      className="text-accent"
                    >
                      {a.career.title}
                    </Link>{" "}
                    · {formatDateTime(a.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.map((st) => (
                    <form action={setApplicationStatus} key={st}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="status" value={st} />
                      <button
                        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                          a.status === st
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

              <div className="mt-4 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-3">
                <Meta label="Discord" value={a.discord} />
                <Meta label="Timezone" value={a.timezone} />
                <Meta label="Portfolio" value={a.portfolio} link />
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                  Message
                </p>
                <p className="mt-1.5 whitespace-pre-line text-muted">
                  {a.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card grid place-items-center px-6 py-20 text-center">
          <p className="font-display text-2xl">No applications</p>
          <p className="mt-2 text-muted">
            {activeCareer
              ? "No one has applied for this role yet."
              : "Applications will appear here as they come in."}
          </p>
        </div>
      )}
    </div>
  );
}

function FilterLink({
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
  link,
}: {
  label: string;
  value: string | null;
  link?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-faint">
        {label}
      </p>
      {value ? (
        link && /^https?:\/\//.test(value) ? (
          <a href={value} className="text-accent hover:underline" target="_blank" rel="noreferrer">
            {value}
          </a>
        ) : (
          <p className="text-fg">{value}</p>
        )
      ) : (
        <p className="text-faint">-</p>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertPartnerFeature, requirePartnerUser } from "@/lib/partners/guard";
import { setPartnerApplicationStatus } from "@/app/actions/partner-content";
import { formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Applications" };

const STATUSES: ApplicationStatus[] = [
  "NEW",
  "REVIEWING",
  "ACCEPTED",
  "REJECTED",
];

export default async function PartnerApplicationsPage({
  params,
}: {
  params: { slug: string };
}) {
  const { partner, canWrite } = await requirePartnerUser(params.slug);
  assertPartnerFeature(partner, "careers");

  // Scoped by partnerId, which the application inherited from the role it was
  // submitted against - so this inbox is only ever this partner's.
  const applications = await prisma.application.findMany({
    where: { partnerId: partner.slug },
    orderBy: { createdAt: "desc" },
    include: { career: true, user: true },
  });

  return (
    <div>
      <div className="mb-8 border-b border-line pb-6">
        <h1 className="display text-4xl">Applications</h1>
        <p className="mt-2 text-sm text-muted">
          People who applied to your roles.
        </p>
      </div>

      {applications.length ? (
        <div className="space-y-3">
          {applications.map((a) => (
            <div key={a.id} className="card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-fg">{a.robloxUsername}</p>
                    <StatusBadge
                      status={
                        a.status === "ACCEPTED"
                          ? "upcoming"
                          : a.status === "REJECTED"
                            ? "closed"
                            : "soldout"
                      }
                    >
                      {a.status}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {a.career.title} · {formatDate(a.createdAt)}
                  </p>
                </div>

                {canWrite ? (
                  <form
                    action={setPartnerApplicationStatus}
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="scope" value={partner.slug} />
                    <select
                      name="status"
                      defaultValue={a.status}
                      className="rounded-brand border border-line bg-bg px-3 py-1.5 text-xs outline-none focus:border-accent"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button className="btn btn-ghost !py-1.5 !px-3 text-xs">
                      Save
                    </button>
                  </form>
                ) : null}
              </div>

              <dl className="mt-5 grid gap-x-8 gap-y-3 border-t border-line pt-4 text-sm sm:grid-cols-3">
                {a.discord ? (
                  <Field label="Discord" value={a.discord} />
                ) : null}
                {a.timezone ? (
                  <Field label="Timezone" value={a.timezone} />
                ) : null}
                {a.portfolio ? (
                  <Field label="Portfolio" value={a.portfolio} link />
                ) : null}
              </dl>

              <p className="mt-4 whitespace-pre-wrap border-t border-line pt-4 text-sm leading-relaxed text-muted">
                {a.message}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <p className="font-display text-2xl uppercase">No applications</p>
          <p className="mt-2 max-w-sm text-sm text-muted">
            Nobody has applied to your roles yet.
          </p>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  link,
}: {
  label: string;
  value: string;
  link?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-faint">
        {label}
      </dt>
      <dd className="mt-0.5 truncate">
        {link ? (
          // rel=noopener: an applicant supplies this URL, and it must not get a
          // handle on the portal window it was opened from.
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-accent hover:text-fg"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

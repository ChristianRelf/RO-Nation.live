import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertPartnerFeature, requirePartnerUser } from "@/lib/partners/guard";
import { partnerPortalPath } from "@/lib/partners/urls";
import { StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Careers" };

export default async function PartnerCareersPage({
  params,
}: {
  params: { slug: string };
}) {
  const { partner, canWrite } = await requirePartnerUser(params.slug);
  assertPartnerFeature(partner, "careers");

  const careers = await prisma.career.findMany({
    where: { partnerId: partner.slug },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { applications: true } } },
  });

  const base = partnerPortalPath(partner.slug, "/studio/careers");

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="display text-4xl">Careers</h1>
          <p className="mt-2 text-sm text-muted">
            Roles on your own site. Applications come to your studio, not RNL&apos;s.
          </p>
        </div>
        {canWrite ? (
          <Link href={`${base}/new`} className="btn btn-accent shrink-0">
            + New role
          </Link>
        ) : null}
      </div>

      {careers.length ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Department</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Applicants</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {careers.map((c) => (
                  <tr key={c.id} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-4 font-semibold text-fg">{c.title}</td>
                    <td className="px-5 py-4 text-muted">{c.department}</td>
                    <td className="px-5 py-4">
                      <StatusBadge
                        status={c.status === "OPEN" ? "upcoming" : "closed"}
                      >
                        {c.status === "OPEN"
                          ? "Open"
                          : c.status === "DRAFT"
                            ? "Draft"
                            : "Closed"}
                      </StatusBadge>
                    </td>
                    <td className="tnum px-5 py-4 text-muted">
                      {c._count.applications}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {canWrite ? (
                        <Link
                          href={`${base}/${c.id}/edit`}
                          className="text-sm text-accent hover:text-fg"
                        >
                          Edit
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <p className="font-display text-2xl uppercase">No roles posted</p>
          <p className="mt-2 max-w-sm text-sm text-muted">
            {canWrite
              ? "Post a role and it appears on your careers page once it's open."
              : "Management hasn't posted any roles yet."}
          </p>
          {canWrite ? (
            <Link href={`${base}/new`} className="btn btn-accent mt-6">
              + New role
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}

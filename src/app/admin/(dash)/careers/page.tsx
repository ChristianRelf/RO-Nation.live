import Link from "next/link";
import { prisma } from "@/lib/db";
import { AdminHeader, Badge } from "@/components/admin-ui";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteCareer } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminCareersPage() {
  await requireAdmin();
  const careers = await prisma.career.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { applications: true } } },
  });

  return (
    <div>
      <AdminHeader
        title="Careers"
        subtitle="Post open roles and track how many people have applied."
        action={{ label: "+ New role", href: "/admin/careers/new" }}
      />

      {careers.length ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Department</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Applicants</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {careers.map((c) => (
                  <tr key={c.id} className="hover:bg-fg/[0.02]">
                    <td className="px-5 py-4">
                      <p className="font-medium">{c.title}</p>
                      <p className="text-xs text-muted">{c.commitment}</p>
                    </td>
                    <td className="px-5 py-4 text-muted">{c.department}</td>
                    <td className="px-5 py-4">
                      <Badge value={c.status} />
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/admin/applications?career=${c.id}`}
                        className="text-accent hover:underline"
                      >
                        {c._count.applications}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/careers/${c.slug}`}
                          className="text-muted hover:text-fg"
                        >
                          View
                        </Link>
                        <Link
                          href={`/admin/careers/${c.id}/edit`}
                          className="text-muted hover:text-fg"
                        >
                          Edit
                        </Link>
                        <form action={deleteCareer}>
                          <input type="hidden" name="id" value={c.id} />
                          <ConfirmButton
                            className="text-faint hover:text-red-400"
                            message={`Delete "${c.title}"? Its applications will be removed too.`}
                          >
                            Delete
                          </ConfirmButton>
                        </form>
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
          <p className="font-display text-2xl">No roles posted</p>
          <Link href="/admin/careers/new" className="btn btn-accent mt-5">
            Post your first role
          </Link>
        </div>
      )}
    </div>
  );
}

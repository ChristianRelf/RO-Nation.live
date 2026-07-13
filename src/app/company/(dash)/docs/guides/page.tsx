import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { AdminHeader, Badge } from "@/components/admin-ui";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteGuide } from "@/app/actions/docs";
import { formatDateTime } from "@/lib/format";
import { requireCompanyUser } from "@/lib/company";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Guides" };

export default async function CompanyGuidesPage() {
  await requireCompanyUser();

  const guides = await prisma.guide.findMany({
    orderBy: [{ section: "asc" }, { order: "asc" }, { title: "asc" }],
  });

  return (
    <div>
      <AdminHeader
        title="Guides"
        subtitle="Read on portal.ronation.live/docs by staff and partner crew. Drafts stay hidden."
        action={{ label: "+ New guide", href: "/company/docs/guides/new" }}
      />

      {guides.length ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-semibold">Guide</th>
                  <th className="px-5 py-3 font-semibold">Section</th>
                  <th className="px-5 py-3 font-semibold">Author</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {guides.map((g) => (
                  <tr key={g.id} className="hover:bg-fg/[0.02]">
                    <td className="px-5 py-4">
                      <span className="font-medium">{g.title}</span>
                      <span className="block text-xs text-muted">
                        {g.publishedAt
                          ? formatDateTime(g.publishedAt)
                          : `Created ${formatDateTime(g.createdAt)}`}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-muted">
                      {g.section}
                      <span className="ml-2 text-xs text-faint">#{g.order}</span>
                    </td>
                    <td className="px-5 py-4 text-muted">{g.authorName}</td>
                    <td className="px-5 py-4">
                      <Badge value={g.status} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/company/docs/guides/${g.id}/edit`}
                          className="text-muted hover:text-fg"
                        >
                          Edit
                        </Link>
                        <form action={deleteGuide}>
                          <input type="hidden" name="id" value={g.id} />
                          <ConfirmButton
                            className="text-faint hover:text-red-400"
                            message={`Delete "${g.title}"? This can't be undone.`}
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
          <p className="font-display text-2xl">No guides yet</p>
          <p className="mt-2 text-sm text-muted">
            Write down how a show actually runs, before the person who knows
            leaves.
          </p>
          <Link href="/company/docs/guides/new" className="btn btn-accent mt-5">
            Write the first one
          </Link>
        </div>
      )}
    </div>
  );
}

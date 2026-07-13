import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { AdminHeader, StatCard } from "@/components/admin-ui";
import { requireCompanyUser } from "@/lib/company";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Docs" };

// The authoring side of portal.ronation.live/docs. Written here, on the main
// site, by RNL — read there, on the portal, by staff and partner crew.

export default async function CompanyDocsPage() {
  await requireCompanyUser();

  const [guides, published, assets, internal] = await Promise.all([
    prisma.guide.count(),
    prisma.guide.count({ where: { status: "PUBLISHED" } }),
    prisma.brandAsset.count(),
    prisma.brandAsset.count({ where: { visibility: "INTERNAL" } }),
  ]);

  return (
    <div>
      <AdminHeader
        title="Docs"
        subtitle="The backstage handbook. Read on portal.ronation.live/docs by anybody with a portal door — including read-only staff."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Guides"
          value={guides}
          hint={`${published} published`}
        />
        <StatCard
          label="Brand assets"
          value={assets}
          hint={`${internal} internal`}
        />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/company/docs/guides"
          className="card p-6 transition-colors hover:border-accent"
        >
          <h2 className="font-display text-xl uppercase">Guides</h2>
          <p className="mt-2 text-sm text-muted">
            Running a show, working the door, how the systems fit together.
          </p>
        </Link>

        <Link
          href="/company/docs/assets"
          className="card p-6 transition-colors hover:border-accent"
        >
          <h2 className="font-display text-xl uppercase">Brand assets</h2>
          <p className="mt-2 text-sm text-muted">
            Logos and press art with shareable links; guideline PDFs that only a
            signed-in reader can open.
          </p>
        </Link>
      </div>
    </div>
  );
}

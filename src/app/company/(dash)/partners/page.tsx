import Link from "next/link";
import { PartnerRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AdminHeader, Badge } from "@/components/admin-ui";
import { requireCompanyUser } from "@/lib/company";
import { activePartners } from "@/lib/partners/registry";
import { partnerOrigin } from "@/lib/partners/urls";

export const dynamic = "force-dynamic";

// Every partner, and who can actually get into their portal.
//
// ---- Why this page exists ---------------------------------------------------
//
// A slug in lib/partners/registry.ts says a partner EXISTS. A PartnerMember row says who
// may open their portal. Those are deliberately different questions - the registry's own
// header is explicit that "a slug in this file grants nobody anything".
//
// Which means the grant table is the entire access model for every partner on this
// platform... and until now the only thing that had ever written a row to it was
// prisma/seed.ts. There was no admin screen, anywhere. Onboarding a partner meant editing
// the registry, deploying, and then hand-writing SQL. And `canManageMembers`, computed on
// every request in lib/partners/guard.ts, was read by absolutely nothing.
//
// The seed is now deleted, which makes this urgent rather than merely overdue.

export default async function CompanyPartnersPage({
  searchParams,
}: {
  searchParams: { ok?: string; error?: string };
}) {
  await requireCompanyUser();

  const partners = activePartners();

  // One query, not one per partner.
  const members = await prisma.partnerMember.groupBy({
    by: ["partnerId", "role"],
    _count: { _all: true },
  });

  const countFor = (slug: string, role: PartnerRole) =>
    members.find((m) => m.partnerId === slug && m.role === role)?._count._all ?? 0;

  return (
    <div>
      <AdminHeader
        title="Partners"
        subtitle="Who runs each partner's portal - and whether anybody can."
      />

      {searchParams.error === "unknown" ? (
        <p className="mb-6 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          That partner isn&apos;t in the registry. A partner has to exist in{" "}
          <code className="font-mono">lib/partners/registry.ts</code> - and that is a
          deploy - before anybody can be given access to it.
        </p>
      ) : null}

      <div className="space-y-4">
        {partners.map((p) => {
          const owners = countFor(p.slug, PartnerRole.OWNER);
          const managers = countFor(p.slug, PartnerRole.MANAGER);
          const staff = countFor(p.slug, PartnerRole.STAFF);
          const total = owners + managers + staff;

          return (
            <div key={p.slug} className="card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-2xl">{p.name}</h2>
                    <span className="pill">{p.slug}</span>
                    {p.governance ? <Badge value="GROUP-GOVERNED" /> : null}
                  </div>

                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    <a
                      href={partnerOrigin(p.slug)}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-accent"
                    >
                      Their site ↗
                    </a>
                    <span className="text-faint">
                      Features: {p.features.length ? p.features.join(", ") : "none"}
                    </span>
                  </p>
                </div>

                <Link
                  href={`/company/partners/${p.slug}`}
                  className="btn btn-ghost !py-2 !px-4 text-xs"
                >
                  {total ? `Manage ${total}` : "Add somebody"}
                </Link>
              </div>

              {/* The state the seed's console.warn was trying to prevent - promoted from a
                  log line nobody reads to a warning on a page somebody looks at.

                  It is not merely "no members": with no OWNER, nobody at the partner can
                  grant anybody else access either, so the partner cannot dig themselves
                  out. Only RNL can. */}
              {owners === 0 ? (
                <p className="mt-4 border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  <span className="font-semibold">Nobody owns this partner.</span>{" "}
                  {total === 0
                    ? "No one at " +
                      p.name +
                      " can sign in to their portal at all."
                    : "Their crew can sign in, but nobody there can grant or revoke access - only RNL can."}
                  {p.governance ? (
                    <>
                      {" "}
                      Their group ranks still open the portal (rank{" "}
                      {p.governance.staffRank}+), but a rank never confers OWNER - see the
                      note in guard.ts.
                    </>
                  ) : null}
                </p>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                  <Count label="Owners" value={owners} />
                  <Count label="Managers" value={managers} />
                  <Count label="Staff" value={staff} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card mt-6 p-6">
        <h2 className="font-display text-xl">Adding a whole new partner</h2>
        <p className="mt-2 text-sm text-muted">
          This page grants access to partners that already exist. Creating one is a
          deploy, on purpose: the slug lives in{" "}
          <code className="font-mono text-fg">src/lib/partners/registry.ts</code>{" "}
          because the middleware has to resolve a brand from the Host header before
          Prisma exists, and it needs DNS, a name on the Caddyfile&apos;s address line,
          and their brand CSS. The registry validates itself at build time, so a typo
          fails the build rather than serving RNL&apos;s site on their domain.
        </p>
        <p className="mt-3 text-sm text-faint">
          RNL staff at rank {""}
          <span className="font-mono">PARTNER_STAFF_RANK</span> and above already open
          every partner portal without a row here - so this list is about the
          partner&apos;s OWN crew, who are not in RNL&apos;s group and never will be.
        </p>
      </div>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full border border-line px-3 py-1 text-xs">
      <span className="font-semibold text-fg">{value}</span>{" "}
      <span className="text-muted">{label}</span>
    </span>
  );
}

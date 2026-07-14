import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AdminHeader } from "@/components/admin-ui";
import { PartnerMembers } from "@/components/partner-members";
import { searchRobloxForCompany } from "@/app/actions/company";
import { requireCompanyUser } from "@/lib/company";
import { partnerBySlug } from "@/lib/partners/registry";
import { partnerOrigin } from "@/lib/partners/urls";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  required: "Pick a Roblox account first.",
  role: "That isn't a role.",
  roblox: "Roblox didn't recognise that account, so nothing was written.",
  already: "They already have access to this partner.",
  missing: "That person is no longer on the list.",
  lastowner: "They're the only owner.",
};

const OK: Record<string, string> = {
  added: "Added. They can sign in now.",
  role: "Role changed.",
  removed: "Removed. Their access is gone immediately.",
};

export default async function CompanyPartnerMembersPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { ok?: string; error?: string };
}) {
  // Guarded on the page itself, not just in the layout - a layout-only redirect still
  // ships this page's RSC payload (here: a partner's whole crew list) inside the body of
  // the 307 that bounced it. The rule is written out in lib/session.ts.
  await requireCompanyUser();

  // Through the registry, never straight to the database. An arbitrary string from the URL
  // must not become a partnerId in a query - a partner that does not exist is a 404, not
  // an empty member list for a slug somebody invented.
  const partner = partnerBySlug(params.slug);
  if (!partner) notFound();

  const members = await prisma.partnerMember.findMany({
    where: { partnerId: partner.slug },
    orderBy: [{ role: "asc" }, { displayName: "asc" }],
  });

  return (
    <div>
      <AdminHeader
        title={partner.name}
        subtitle="Who at this partner can open their portal - and what they can do once they're in."
      />

      <p className="mb-6 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href="/company/partners" className="text-muted hover:text-fg">
          ← All partners
        </Link>
        <a
          href={partnerOrigin(partner.slug)}
          target="_blank"
          rel="noreferrer"
          className="text-muted hover:text-accent"
        >
          Their site ↗
        </a>
      </p>

      {searchParams.error ? (
        <p className="mb-6 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {MESSAGES[searchParams.error] ?? "That didn't work."}
        </p>
      ) : null}
      {searchParams.ok ? (
        <p className="mb-6 border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
          {OK[searchParams.ok] ?? "Done."}
        </p>
      ) : null}

      <PartnerMembers
        slug={partner.slug}
        via="company"
        members={members}
        search={searchRobloxForCompany}
        // RNL may remove a partner's last owner. For RNL that is offboarding, not a
        // lockout - and RNL is the only party who can put one back.
        canRemoveLastOwner
      />
    </div>
  );
}

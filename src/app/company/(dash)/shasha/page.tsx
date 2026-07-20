import type { Metadata } from "next";
import { PartnerRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AdminHeader } from "@/components/admin-ui";
import { PartnerMembers } from "@/components/partner-members";
import { searchRobloxForCompany } from "@/app/actions/company";
import { requireCompanyUser } from "@/lib/company";
import { SHASHA_SCOPE } from "@/lib/shasha";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "SHASHA access" };

// Granting somebody the SHASHA portal without ranking them in RNL's Roblox group.
//
// The group is still the main door and nothing here replaces it - see lib/shasha.ts
// for how the two compose. This screen is for the people the group cannot express: a
// contractor on one show, a promoter working their own door for a night, somebody's
// manager who needs the blacklist and should not be given a staff rank to get it.
//
// Guarded on the page itself, not just in the layout - a layout-only redirect still
// ships this page's RSC payload inside the body of the 307 that bounced it. The rule
// is written out in lib/session.ts.

const MESSAGES: Record<string, string> = {
  required: "Pick a Roblox account first.",
  role: "That isn't a role.",
  roblox: "Roblox didn't recognise that account, so nothing was written.",
  already: "They already have a grant.",
  missing: "That person is no longer on the list.",
};

const OK: Record<string, string> = {
  added: "Added. They can sign in now.",
  role: "Role changed.",
  removed: "Removed. Their grant is gone immediately.",
};

export default async function CompanyShashaAccessPage({
  searchParams,
}: {
  searchParams: { ok?: string; error?: string };
}) {
  await requireCompanyUser();

  const members = await prisma.partnerMember.findMany({
    where: { partnerId: SHASHA_SCOPE },
    orderBy: [{ role: "asc" }, { displayName: "asc" }],
  });

  return (
    <div>
      <AdminHeader
        title="SHASHA access"
        subtitle="Give somebody the portal without ranking them in the Roblox group."
      />

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

      <div className="card mb-6 p-6">
        <h2 className="font-display text-xl">How this fits with the group</h2>
        <p className="mt-2 text-sm text-muted">
          Rank {env.shasha.minRank}+ in RNL&apos;s Roblox group already opens the
          SHASHA portal, and rank {env.shasha.managerRank}+ can edit the lists.
          Nobody who gets in that way needs to be listed here, and adding them
          changes nothing.
        </p>
        <p className="mt-3 text-sm text-muted">
          The two compose, and only upwards: whichever says more wins. A grant of
          Staff will not demote a ranked manager, and revoking a grant does not
          shut out somebody whose rank would have let them in anyway. To remove
          that person you change their rank in the group.
        </p>
      </div>

      <PartnerMembers
        slug={SHASHA_SCOPE}
        via="company"
        members={members}
        search={searchRobloxForCompany}
        // Owner is a partner-side idea: it means "may grant others", and SHASHA
        // membership is administered here by company users only. There is nothing
        // for an owner to be, so the tier is not offered.
        roles={[PartnerRole.STAFF, PartnerRole.MANAGER]}
        // No last-owner lock to honour, for the same reason - and the group is
        // still there regardless, so this list can safely be emptied.
        canRemoveLastOwner
        emptyNote="Nobody holds a grant. The Roblox group still opens the portal on rank, so this being empty is the normal state."
      />
    </div>
  );
}

import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { PartnerMembersClient } from "./members-client";
import { requirePartnerOwner } from "@/lib/partners/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Access" };

// portal.ronation.live/<slug>/members - who else may sign in here.
//
// OWNERS ONLY. `canManageMembers` is the one thing that separates an OWNER from a MANAGER
// (schema.prisma: "a manager who can also grant and revoke other members"), it has been
// computed on every request in guard.ts since the day the file was written, and until now
// absolutely nothing read it. This is the page it was computed for.
//
// The guard is called HERE, in the page, and not left to the layout. A layout-only
// redirect still ships this page's RSC payload - the partner's entire crew list, with
// Roblox ids - inside the body of the 307 that bounced the request. The rule is written
// out in lib/partners/guard.ts and it is not optional.
//
// A partner's own OWNER may not remove or demote the last remaining owner: doing so would
// lock their organisation out of its own access admin, permanently, with no route back
// that does not involve RNL and a shell. RNL staff CAN, from /company/partners - for them
// it is offboarding, and they are the only party who can put an owner back.

const MESSAGES: Record<string, string> = {
  required: "Pick a Roblox account first.",
  role: "That isn't a role.",
  roblox: "Roblox didn't recognise that account, so nothing was written.",
  already: "They already have access.",
  missing: "That person is no longer on the list.",
  lastowner:
    "They're your only owner. Promote somebody else first - otherwise nobody here could grant access again, and you'd need RNL to let you back in.",
};

const OK: Record<string, string> = {
  added: "Added. They can sign in now.",
  role: "Role changed.",
  removed: "Removed. Their access is gone immediately.",
};

export default async function PartnerMembersPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { ok?: string; error?: string };
}) {
  const user = await requirePartnerOwner(params.slug);

  const members = await prisma.partnerMember.findMany({
    where: { partnerId: user.partner.slug },
    orderBy: [{ role: "asc" }, { displayName: "asc" }],
  });

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-kicker text-accent">
          {user.partner.name}
        </p>
        <h1 className="display mt-1 text-3xl">Access</h1>
        <p className="mt-2 text-muted">
          Everybody who can sign in to this portal, and what they can do once they are
          in. Removing somebody takes effect on their next request.
        </p>
      </header>

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

      <PartnerMembersClient slug={user.partner.slug} members={members} />

      {user.partner.governance ? (
        <p className="mt-8 border-t border-line pt-6 text-sm text-faint">
          This list is not the only way in. Anybody at rank{" "}
          <span className="font-mono text-muted">
            {user.partner.governance.staffRank}
          </span>{" "}
          or above in your Roblox group can already open this portal, and rank{" "}
          <span className="font-mono text-muted">
            {user.partner.governance.managerRank}
          </span>{" "}
          or above can write. A row here is a FLOOR, never a ceiling - it can grant
          access to somebody outside the group, but it cannot take it away from somebody
          your group has already given it to. Change that in your group, not here.
        </p>
      ) : null}
    </div>
  );
}

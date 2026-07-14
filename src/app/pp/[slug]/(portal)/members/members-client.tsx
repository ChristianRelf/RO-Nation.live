"use client";

import type { PartnerMember } from "@prisma/client";
import { searchRoblox } from "@/app/actions/portal";
import { PartnerMembers } from "@/components/partner-members";

// A three-line client wrapper, and the reason is a real boundary rather than a preference.
//
// <PartnerMembers> needs a `search` function. The partner's is scope-bound -
// searchRoblox(slug, query), guarded by requireScopeUser(slug) so it is not an open Roblox
// proxy - and binding that slug produces a CLOSURE. A closure cannot cross from a server
// component to a client one: React can serialise a reference to a server action, but not a
// function that captured a variable.
//
// So the binding happens here, on the client, where the closure is created and never has to
// be serialised. RNL's side needs no wrapper at all - searchRobloxForCompany takes no scope
// (it has its own requireCompanyUser guard), so the server page passes the action reference
// straight through.

export function PartnerMembersClient({
  slug,
  members,
}: {
  slug: string;
  members: PartnerMember[];
}) {
  return (
    <PartnerMembers
      slug={slug}
      via="portal"
      members={members}
      search={(query) => searchRoblox(slug, query)}
      // A partner's owner may NOT remove their own last owner. RNL can, from
      // /company/partners - for RNL that is offboarding; here it would be a permanent
      // lockout with no way back that does not involve RNL and a shell.
      canRemoveLastOwner={false}
    />
  );
}

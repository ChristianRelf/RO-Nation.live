import { getUserSession } from "@/lib/session";
import { getGroupMembership } from "@/lib/roblox-group";
import { env } from "@/lib/env";
import { HeaderClient } from "./header-client";

export async function SiteHeader() {
  const session = await getUserSession();

  // Only ranked group members are shown the Company link. The rank lookup is
  // cached per user for a few minutes, so this isn't a Roblox round-trip on
  // every page render.
  //
  // It is presentation ONLY - showing the link is not granting anything, and
  // hiding it is not withholding anything. /company re-checks the rank itself on
  // every page and every write (lib/company.ts).
  const membership = session
    ? await getGroupMembership(session.robloxId, env.company.groupId)
    : null;
  const canCompany = (membership?.rank ?? 0) >= env.company.minRank;

  return (
    <HeaderClient
      account={
        session
          ? {
              displayName: session.displayName,
              username: session.username,
              avatarUrl: session.avatarUrl ?? null,
            }
          : null
      }
      canCompany={canCompany}
    />
  );
}

import { getUserSession, isAdmin } from "@/lib/session";
import { getGroupMembership } from "@/lib/roblox-group";
import { env } from "@/lib/env";
import { HeaderClient } from "./header-client";

export async function SiteHeader() {
  const [session, admin] = await Promise.all([getUserSession(), isAdmin()]);

  // Only ranked group members are shown the Studio link. The rank lookup is
  // cached per user for a few minutes, so this isn't a Roblox round-trip on
  // every page render.
  const membership = session
    ? await getGroupMembership(session.robloxId)
    : null;
  const isStudio = (membership?.rank ?? 0) >= env.studio.minRank;

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
      isAdmin={admin}
      isStudio={isStudio}
    />
  );
}

import { getUserSession, isAdmin } from "@/lib/session";
import { HeaderClient } from "./header-client";

export async function SiteHeader() {
  const [session, admin] = await Promise.all([getUserSession(), isAdmin()]);
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
    />
  );
}

import { requirePayUser } from "@/lib/pay";
import { PayShell } from "@/components/pay/pay-shell";
import { countOpenRequestsFor } from "@/lib/accounting/requests";

export const dynamic = "force-dynamic";

/**
 * The chrome for the signed-in half of pay.ronation.live.
 *
 * It resolves the user because the SHELL needs them - a name, an avatar, the ENTITY whose
 * money this is, and the count on the "Your requests" tab. The redirect inside
 * requirePayUser() here is a courtesy, NOT the lock: a page segment renders in parallel
 * with its layout and is serialised into the RSC payload either way, so a layout-only
 * guard still ships the page's body. Every page under here calls requirePayUser() itself
 * before it reads a row - that is the lock. Same rule, same reason, as the /partner area.
 */
export default async function PayAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePayUser();
  const openRequests = await countOpenRequestsFor(user.account.id);

  return (
    <PayShell
      user={{ displayName: user.displayName, avatarUrl: user.avatarUrl }}
      accountName={user.account.name}
      openRequests={openRequests}
    >
      {children}
    </PayShell>
  );
}

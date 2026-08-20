import type { Metadata } from "next";
import { requirePartnerAccount, isFullPartner } from "@/lib/partner-account";
import { PartnerShell } from "@/components/partner/partner-shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Partners", template: "%s · Partners" },
  robots: { index: false, follow: false },
};

/**
 * The partner-area gate.
 *
 * Resolves the partner because the SHELL needs them - a name, an avatar, whether to show the
 * Accounting tab. The redirect inside requirePartnerAccount() here is a courtesy, NOT the lock:
 * a page segment renders in parallel with its layout and is serialised into the RSC payload
 * either way, so a layout-only guard still ships the page's body. Every page under here calls
 * requirePartnerAccount() itself before reading data - that is the lock. See lib/session.ts.
 */
export default async function PartnerAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePartnerAccount();

  return (
    <PartnerShell
      user={{ displayName: user.displayName, avatarUrl: user.avatarUrl }}
      showAccounting={isFullPartner(user.account)}
    >
      {children}
    </PartnerShell>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCompanyAccess } from "@/lib/company";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Accounts", template: "%s · Accounts" },
  robots: { index: false, follow: false },
};

/**
 * The gate on accounts.ronation.live.
 *
 * ---- What this covers, and what it deliberately does not -------------------
 *
 * It covers /accounts/… - the internal prefix the whole staff desk is rewritten to. It
 * does NOT cover /document/<kind>/<token>, which is served on this host as-is and is
 * anonymous BY DESIGN: a contractor reading their payslip has no account here and never
 * will. That route lives outside this segment for exactly that reason, and the middleware
 * exempts it from the sign-in gate too (ACCOUNTS_PUBLIC_PATHS). If anybody ever moves the
 * document route under this layout, the symptom will be RNL's own recipients bounced to a
 * Roblox sign-in they cannot complete, on a link RNL sent them.
 *
 * ---- And this redirect is the belt, not the braces ------------------------
 *
 * A page segment is serialised into the RSC payload regardless of what its layout
 * renders, so every page below ALSO calls requireCompanyUser() before it reads a row -
 * that page-level guard is the one actually withholding the money. See lib/session.ts.
 *
 * ---- Why the redirect is absolute -----------------------------------------
 *
 * /company/access is on the MAIN site. A bare redirect("/company/access") resolves
 * against accounts.ronation.live, the middleware rewrites it to /accounts/company/access,
 * and it 404s - turning "you don't have access" into "that page doesn't exist", which is
 * the least useful answer available. Every cross-host link in this area is absolute for
 * this reason; see lib/accounting/urls.ts.
 */
export default async function AccountsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getCompanyAccess();
  if (access.state !== "allowed") redirect(`${env.siteUrl}/company/access`);
  return <>{children}</>;
}

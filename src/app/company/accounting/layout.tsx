import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCompanyAccess } from "@/lib/company";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Accounting", template: "%s · Company" },
  robots: { index: false, follow: false },
};

/**
 * The accounting gate.
 *
 * Outside the (dash) group for the same reason /company/invoices is: the DOCUMENT page
 * is a bare printable sheet, and a layout that wrapped it in the company sidebar would
 * print the sidebar. The list and builder pages draw the shell themselves.
 *
 * And, like both of those, this redirect is a belt rather than the braces. A page
 * segment is serialised into the RSC payload regardless of what its layout renders, so
 * every page below ALSO calls requireCompanyUser() before it reads a row - that
 * page-level guard is the one actually withholding the money.
 */
export default async function CompanyAccountingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getCompanyAccess();
  if (access.state !== "allowed") redirect("/company/access");
  return <>{children}</>;
}

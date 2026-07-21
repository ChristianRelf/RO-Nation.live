import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCompanyAccess } from "@/lib/company";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Invoices", template: "%s · Company" },
  robots: { index: false, follow: false },
};

/**
 * The Company invoices gate.
 *
 * These pages live OUTSIDE the (dash) group on purpose: the invoice DOCUMENT
 * (/company/invoices/[slug]/[invoiceid]) is a bare, printable page, and a layout that
 * wrapped it in the company sidebar would print the sidebar. So this subtree carries its
 * own gate instead of inheriting (dash)'s - the LIST pages draw the shell themselves
 * (CompanyShell), the document draws nothing around itself.
 *
 * Like (dash)'s layout, this redirect is a belt, not the braces: it must NOT render an
 * in-place "no access" screen, because a page segment is serialised into the RSC payload
 * regardless of what the layout renders. Each page below ALSO calls requireCompanyUser()
 * before it reads a thing - that page-level guard is the one that actually withholds the
 * data. See the note in (dash)/layout.tsx.
 */
export default async function CompanyInvoicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getCompanyAccess();
  if (access.state !== "allowed") redirect("/company/access");
  return <>{children}</>;
}

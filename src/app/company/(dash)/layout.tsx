import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCompanyAccess } from "@/lib/company";
import { CompanyShell } from "@/components/company-shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Company", template: "%s · Company" },
  robots: { index: false, follow: false },
};

/**
 * The Company gate.
 *
 * This MUST redirect rather than render a "no access" screen in place of
 * `children`. In the App Router a page segment renders and is serialised into
 * the RSC payload independently of whether its layout chooses to render
 * `children` - so swapping the UI would still ship the page's data (draft
 * events, post bodies) to someone who isn't allowed to see it. redirect()
 * aborts the whole route render, which is the only thing that actually withholds
 * it. The unauthorised messaging lives at /company/access instead.
 */
export default async function CompanyDashLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getCompanyAccess();
  if (access.state !== "allowed") redirect("/company/access");

  return <CompanyShell user={access.user}>{children}</CompanyShell>;
}

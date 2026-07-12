import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPortalUser } from "@/lib/session";
import { PortalNav } from "@/components/portal-nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "SHASHA", template: "%s · SHASHA" },
  robots: { index: false, follow: false },
};

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getPortalUser();
  if (!user) redirect("/shasha/login");

  return (
    <div className="min-h-dvh">
      <PortalNav
        user={{
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          role: user.role,
        }}
      />
      <main className="shell py-10">{children}</main>
    </div>
  );
}

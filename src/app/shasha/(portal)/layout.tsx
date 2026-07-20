import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPortalUser } from "@/lib/shasha";
import { getPortalSwitcher } from "@/lib/hub";
import { PortalNav } from "@/components/portal-nav";
import { PortalFooter } from "@/components/portal-footer";

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

  // Chrome, like everything else in this layout: the switcher lists the doors this
  // person already holds, and each one guards itself on arrival.
  const areas = await getPortalSwitcher();

  return (
    // Column layout so the footer sits at the bottom of the viewport on short
    // pages rather than floating under the content.
    <div className="flex min-h-dvh flex-col">
      <PortalNav
        brand="SHASHA"
        basePath="/shasha"
        scopeId="shasha"
        areas={areas}
        keysLink={user.canWrite}
        user={{
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          roleLabel: user.canWrite ? "Management" : "Read only",
          canWrite: user.canWrite,
        }}
      />
      <main className="shell flex-1 py-10">{children}</main>
      <PortalFooter />
    </div>
  );
}

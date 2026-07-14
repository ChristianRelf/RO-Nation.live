import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDocsReader } from "@/lib/docs-guard";
import { DocsHeader } from "@/components/docs-header";
import { DocsNav } from "@/components/docs-nav";
import { PortalFooter } from "@/components/portal-footer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Docs", template: "%s · Docs" },
  robots: { index: false, follow: false },
};

export default async function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This resolves the reader because the NAV needs them - a name, an avatar, and
  // whether to show the API link. The redirect below is a courtesy, not the lock:
  // a page segment renders in parallel with its layout and is serialised into the
  // RSC payload either way, so a layout-only guard still ships the page's body in
  // the 307 it bounced you with. See lib/session.ts.
  //
  // Every page under here calls requireDocsReader() - or requireDocsUser(), on
  // /docs/api - itself. That is the lock.
  const reader = await getDocsReader();
  if (!reader) redirect("/docs/login");

  return (
    <div className="flex min-h-dvh flex-col">
      <DocsHeader
        user={{
          displayName: reader.displayName,
          avatarUrl: reader.avatarUrl,
        }}
      />

      <div className="shell flex-1 py-10">
        <div className="grid gap-10 lg:grid-cols-[210px_1fr]">
          <DocsNav showApi={reader.canMintKeys} />
          {/* min-w-0 so a wide code block scrolls inside itself rather than
              stretching the grid column and the whole page with it. */}
          <div className="min-w-0">{children}</div>
        </div>
      </div>

      <PortalFooter />
    </div>
  );
}

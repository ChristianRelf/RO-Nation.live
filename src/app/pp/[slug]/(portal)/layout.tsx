import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { partnerBySlug, partnerHasFeature } from "@/lib/partners/registry";
import { getPartnerUser } from "@/lib/partners/guard";
import { partnerPortalPath } from "@/lib/partners/urls";
import { PortalNav } from "@/components/portal-nav";
import { PortalFooter } from "@/components/portal-footer";

export const dynamic = "force-dynamic";

// The partner's portal, at portal.ronation.live/<slug> (rewritten here by the
// middleware). Same tool as SHASHA — the roster pages under this layout are
// literally the same components — pointed at the partner's own lists.

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const partner = partnerBySlug(params.slug);
  const name = partner?.name ?? "Portal";
  return {
    title: { default: name, template: `%s · ${name}` },
    robots: { index: false, follow: false },
  };
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Management",
  STAFF: "Read only",
};

export default async function PartnerPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const partner = partnerBySlug(params.slug);
  if (!partner) notFound();

  // Chrome only. This does NOT protect the pages beneath it — each one guards
  // itself, because a layout redirect still ships the page's RSC payload. See
  // the note on requirePartnerUser() in lib/partners/guard.ts.
  const user = await getPartnerUser(partner.slug);
  if (!user) redirect(`${partnerPortalPath(partner.slug)}/login`);

  return (
    // Column layout so the footer sits at the bottom of the viewport on short
    // pages rather than floating under the content.
    <div className="flex min-h-dvh flex-col">
      <PortalNav
        brand={partner.name}
        basePath={partnerPortalPath(partner.slug)}
        // Every partner has a studio — at minimum they can edit their homepage
        // — so this is always on. Which SECTIONS it offers is what the registry's
        // features decide, inside the studio layout.
        doorLink={partnerHasFeature(partner, "events")}
        studioLink
        // Only an org with shows has tickets for a key to touch, and only a
        // manager may mint one.
        keysLink={user.canWrite && partnerHasFeature(partner, "events")}
        user={{
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          roleLabel: ROLE_LABELS[user.role] ?? "Read only",
          canWrite: user.canWrite,
        }}
      />
      <main className="shell flex-1 py-10">{children}</main>
      <PortalFooter />
    </div>
  );
}

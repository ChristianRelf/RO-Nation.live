import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  partnerBySlug,
  partnerHasFeature,
  type Partner,
} from "@/lib/partners/registry";
import { partnerPortalPath } from "@/lib/partners/urls";
import { StudioNav } from "@/components/partner/studio-nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Studio", template: "%s · Studio" },
  robots: { index: false, follow: false },
};

// A partner's studio: where they author their own site.
//
// This is CHROME ONLY. It does not guard the pages beneath it - each one calls
// requirePartnerUser/requirePartnerManager and assertPartnerFeature itself, for
// the reason spelled out in lib/partners/guard.ts: a layout that redirects still
// ships the page's RSC payload in the body of the 307 it bounced you with.
//
// The section list is built from the registry's `features`, so a partner without
// the blog feature has no Blog tab - and, more importantly, no /studio/blog route
// to reach anyway.

/** The tabs this partner actually has. Mirrors the routes that exist. */
function studioSections(partner: Partner) {
  return [
    { label: "Overview", href: "" },
    // Venues ride on the `events` feature - a partner who cannot run shows has no use for
    // a room to put one in, and the venue pages assert the same feature.
    ...(partnerHasFeature(partner, "events")
      ? [
          { label: "Shows", href: "/events" },
          { label: "Venues", href: "/venues" },
        ]
      : []),
    ...(partnerHasFeature(partner, "blog")
      ? [{ label: "Blog", href: "/blog" }]
      : []),
    ...(partnerHasFeature(partner, "careers")
      ? [
          { label: "Careers", href: "/careers" },
          { label: "Applications", href: "/applications" },
        ]
      : []),
    { label: "Homepage", href: "/content" },
  ];
}

export default function PartnerStudioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const partner = partnerBySlug(params.slug);
  if (!partner) notFound();

  return (
    <div>
      <StudioNav
        basePath={partnerPortalPath(partner.slug, "/studio")}
        sections={studioSections(partner)}
      />
      {children}
    </div>
  );
}

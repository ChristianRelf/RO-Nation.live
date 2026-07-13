import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { partnerBySlug } from "@/lib/partners/registry";
import { partnerOrigin } from "@/lib/partners/urls";
import { PartnerHeader } from "@/components/partner/partner-header";
import { PartnerFooter } from "@/components/partner/partner-footer";
import { PartnerBackdrop } from "@/components/partner/backdrop";

// A partner's site. Reached only by rewrite, from <slug>.ronation.live — see
// src/middleware.ts. The pretty URL the visitor sees has no /p/<slug> in it.
//
// The chrome lives here; the palette arrives separately, via data-brand on
// <html> — see the root layout for why it has to be imported there and not here.

type Params = { params: { slug: string } };

export function generateViewport({ params }: Params): Viewport {
  const partner = partnerBySlug(params.slug);
  return {
    // Duplicates --bg, unavoidably: `viewport` is a JS export and cannot read a
    // CSS variable. The registry is the one place that fact is recorded.
    themeColor: partner?.themeColor ?? "#08080b",
    colorScheme: "dark",
  };
}

export function generateMetadata({ params }: Params): Metadata {
  const partner = partnerBySlug(params.slug);
  if (!partner) return {};

  const origin = partnerOrigin(partner.slug);
  return {
    metadataBase: new URL(origin),
    title: { default: `${partner.name} — ${partner.tagline}`, template: `%s · ${partner.name}` },
    description: partner.description,
    openGraph: {
      title: `${partner.name} — ${partner.tagline}`,
      description: partner.description,
      url: origin,
      siteName: partner.name,
      type: "website",
    },
  };
}

export default function PartnerLayout({
  children,
  params,
}: Params & { children: React.ReactNode }) {
  // Defence in depth. Middleware only rewrites here for a registered, active
  // partner, so this should be unreachable — but the route exists, and a route
  // that trusts its own params to be valid is one refactor away from not being.
  const partner = partnerBySlug(params.slug);
  if (!partner) notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Behind everything, fixed, on every page of this partner's site — so it
          is here in the layout rather than on the homepage. Renders nothing for a
          partner with no backdrop, which is all of them by default. */}
      <PartnerBackdrop partner={partner} />

      <PartnerHeader partner={partner} />
      <main className="flex-1">{children}</main>
      <PartnerFooter partner={partner} />
    </div>
  );
}

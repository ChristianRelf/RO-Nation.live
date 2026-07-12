import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { partnerBySlug } from "@/lib/partners/registry";
import { partnerOrigin } from "@/lib/partners/urls";

// A partner's site. Reached only by rewrite, from <slug>.ronation.live — see
// src/middleware.ts. The pretty URL the visitor sees has no /p/<slug> in it.
//
// This layout brings no chrome of its own yet: the bespoke header, footer and
// home page are the partner's build. What it does bring is the metadata and the
// theme colour. The palette arrives separately, via data-brand on <html> — see
// the root layout for why it has to be imported there rather than here.

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
    title: { default: partner.name, template: `%s · ${partner.name}` },
    openGraph: {
      title: partner.name,
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
  if (!partnerBySlug(params.slug)) notFound();

  return <>{children}</>;
}

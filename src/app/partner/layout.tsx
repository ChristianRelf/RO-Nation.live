import type { Metadata } from "next";
import { partnerProgramOrigin } from "@/lib/partner-urls";

// The whole of partner.ronation.live. Everything under app/partner is served on that host
// and nowhere else - see the programme branch in src/middleware.ts, which rewrites the
// host onto this prefix exactly as accounts and pay are rewritten onto theirs.
//
// This layout holds NO chrome, deliberately. The host has two audiences and therefore two
// shells - ProgrammeShell out front, PartnerShell behind the gate - and each page picks the
// one it needs. What is shared is the title template and the metadata base, which is worth
// having in one place: without metadataBase pointing at THIS origin, an Open Graph image on
// the programme page resolves against ronation.live and shares the wrong site's card.
//
// robots is NOT set here, and that is the point of putting it per-page instead. The
// programme page wants indexing - it is the front door of a commercial offer. The hub, the
// invitations and the briefs very much do not, and each says so for itself.
//
// ---- openGraph is REPLACED down the chain, not merged ----------------------
//
// Next merges metadata field by field, but a nested object like `openGraph` is swapped
// wholesale by the deepest segment that declares one - it is not deep-merged. That is the
// trap this block exists to close, and it bites in both directions:
//
//   - Without an openGraph HERE, every page on this host inherits the ROOT layout's, whose
//     og:url is ronation.live. Sharing a partner-host link previewed as the main site.
//   - A page that declares its own openGraph loses everything in this one, so any page
//     overriding the title must restate url, siteName and images. app/partner/page.tsx
//     does, and says so.
//
// The image is the root segment's generated card (app/opengraph-image.tsx). It is served at
// /opengraph-image on this host too - but ONLY because "/opengraph-image" is on
// PROGRAMME_PATHS and PROGRAMME_PUBLIC_PATHS in the middleware. Left off either list, this
// tag points at a redirect to a sign-in page and every preview comes out blank.
export const metadata: Metadata = {
  metadataBase: new URL(partnerProgramOrigin()),
  title: {
    default: "Partner with RO. Nation LIVE",
    template: "%s · RNL Partners",
  },
  openGraph: {
    type: "website",
    siteName: "RO. Nation LIVE Partners",
    // Relative, resolved against metadataBase above - so it is this host, not the apex.
    //
    // It points at the programme rather than at each page, and that is deliberate: every
    // page inheriting this one is noindex (the hub, an invitation, a brief, the thanks
    // page), so the useful thing for a preview card to name is the public front of the
    // host. The one page that genuinely wants its own og:url is the programme itself,
    // and its metadata sets it.
    url: "/",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/opengraph-image"],
  },
};

export default function PartnerHostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

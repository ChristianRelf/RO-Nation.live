import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

// Every brand's palette, scoped to :root[data-brand="<slug>"].
//
// It has to be imported *here*, not in the partner layout, for the same reason
// the fonts are: identity has to resolve wherever <html> renders, and Next
// renders its 404 and error boundaries outside your nested layouts. Import it
// one level down and a partner's 404 comes out in RNL's blue - on their domain.
// The cost is a few hundred bytes of unused custom properties on RNL's pages;
// nothing is fetched or painted unless data-brand actually matches.
import "@/styles/brands/index.css";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MemberNotifier } from "@/components/notifications/member-notifier";
import { site } from "@/lib/site";
import { env } from "@/lib/env";
import { fontClassFor } from "@/lib/partners/fonts";

// RNL's own metadata and viewport. A partner layout exports its own: Next
// merges metadata down the segment chain field by field, deepest wins, so a
// partner overrides the title template and theme colour without touching this.
export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: `${site.name} - ${site.tagline}`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  openGraph: {
    title: `${site.name} - ${site.tagline}`,
    description: site.description,
    url: env.siteUrl,
    siteName: site.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: site.name,
    description: site.description,
  },
  icons: {
    icon: [{ url: "/brand/RNL_FAVICON_BLACK.jpg", type: "image/jpeg" }],
    shortcut: "/brand/RNL_FAVICON_BLACK.jpg",
    apple: "/brand/RNL_FAVICON_BLACK.jpg",
  },
};

export const viewport: Viewport = {
  themeColor: "#08080b",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The SHASHA portal, the survey subdomain and the partner sites are their own
  // products - they bring their own chrome, so the marketing header/footer is
  // left off. Both headers are set by middleware, from the request host, and
  // overwritten on every path through it; a client cannot supply either.
  // See src/middleware.ts.
  const h = headers();
  const area = h.get("x-ron-area");
  const brand = h.get("x-ron-brand") || null;

  const bare =
    area === "portal" ||
    area === "survey" ||
    area === "partner" ||
    area === "partner-portal" ||
    // partner.ronation.live - the partner programme. Bare like the rest, but for a reason
    // the others do not have: HALF of this host is public. The programme page and the
    // application form are read by strangers, and they bring their own header and footer
    // (ProgrammeShell) rather than the site's, because "Book tickets" above a page
    // explaining a commercial partnership reads as the wrong company answering.
    area === "partner-program" ||
    area === "shop" ||
    // The accounting desk and its documents. See areaFor() in middleware.ts: a document
    // is a printable sheet, and neither the header nor the footer here is no-print, so
    // wrapping one means printing the marketing nav onto an invoice.
    area === "accounting" ||
    // pay.ronation.live - the client side of the payment system. Its own shell, for the
    // same reason the desk has one: a page where somebody reads what they are owed does
    // not want "Book tickets" above it and a newsletter sign-up below it.
    area === "pay";

  // Where a signed-in member browses AS a member: RNL's own site and a partner's public site.
  // The change-notice modal belongs on those, and not on the staff portal, the survey host or
  // the shop - a member is not there to be told their gig moved. `partner` is `bare`, so it has
  // to be added back explicitly.
  const memberFacing = !bare || area === "partner";

  // data-brand must sit on <html>, not on a wrapper: `body { background-color:
  // var(--bg) }` resolves at body, and a descendant cannot retroactively change
  // what body already computed. Same reason the font class goes here.
  return (
    <html lang="en" data-brand={brand ?? undefined} className={fontClassFor(brand)}>
      <body className="grain min-h-dvh antialiased">
        {bare ? (
          children
        ) : (
          <>
            <SiteHeader />
            <main className="min-h-[60vh]">{children}</main>
            <SiteFooter />
          </>
        )}
        {memberFacing ? <MemberNotifier /> : null}
      </body>
    </html>
  );
}

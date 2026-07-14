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
    area === "shop";

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
      </body>
    </html>
  );
}

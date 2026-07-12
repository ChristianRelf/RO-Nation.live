import type { Metadata, Viewport } from "next";
import { Anton, Archivo, JetBrains_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { site } from "@/lib/site";
import { env } from "@/lib/env";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  openGraph: {
    title: `${site.name} — ${site.tagline}`,
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
  // The SHASHA staff portal (portal.ronation.live/shasha) is its own product —
  // it brings its own nav, so the marketing chrome is left off. Tagged by
  // middleware; see src/middleware.ts.
  const isPortal = headers().get("x-ron-area") === "portal";

  return (
    <html
      lang="en"
      className={`${archivo.variable} ${anton.variable} ${jetbrains.variable}`}
    >
      <body className="grain min-h-dvh antialiased">
        {isPortal ? (
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

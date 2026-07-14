import type { Metadata } from "next";
import { ShopHeader } from "@/components/shop/shop-header";
import { ShopFooter } from "@/components/shop/shop-footer";
import { VenueWall } from "@/components/shop/venue-wall";
import { merchOrigin } from "@/lib/merch/urls";

// The shop, at merch.ronation.live. Everything under /merch is an INTERNAL path -
// the middleware rewrites the host's URLs onto it, so /sleeptoken renders
// /merch/sleeptoken and the pretty URL survives. See src/middleware.ts.
//
// The root layout leaves this area bare (areaFor → "shop"), so the chrome below is
// the only chrome: no marketing header, no "Book tickets".

export const metadata: Metadata = {
  // metadataBase decides what a RELATIVE og:image resolves against, and the root
  // layout sets it to the main site. Left alone, every share card for every product
  // on this host would advertise ronation.live.
  metadataBase: new URL(merchOrigin()),
  title: {
    default: "Merch - RO. Nation LIVE",
    template: "%s · RNL Merch",
  },
  description:
    "Roblox clothing from RO. Nation LIVE and the shows we produce. See it on a character, then buy it on Roblox.",
};

export default function MerchLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* The room. Fixed, behind everything, zero JavaScript. */}
      <VenueWall />
      <ShopHeader />
      <main className="flex-1">{children}</main>
      <ShopFooter />
    </div>
  );
}

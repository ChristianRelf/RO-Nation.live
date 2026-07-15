import type { Metadata } from "next";
import { LegalDoc, type LegalSection } from "@/components/legal-doc";
import { site } from "@/lib/site";
import { legalUpdated } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Merch & Refunds",
  description:
    "How the RO. Nation LIVE shop works: a showcase that hands off to Roblox. Every purchase happens on Roblox, in Robux, under Roblox's own terms and refund rules - we take no payment and issue no refunds.",
};

// This policy describes what the shop CODE actually does. The shop is a showcase: it reads
// the RNL group's Roblox clothing catalog (lib/merch/roblox.ts) and links out to Roblox's
// catalog page, which is "where the money actually changes hands" (lib/merch/urls.ts,
// robloxCatalogUrl). RNL takes NO payment - there is no checkout here, no card, no Robux
// handled by us. So the only honest refund policy is: the sale is Roblox's, and Roblox's
// refund rules govern it. Do not write a returns process this site cannot perform.
//
// The tribute/fan disclaimer mirrors the per-collection `disclaimer` in
// lib/merch/collections.ts - keep it consistent with that.

const sections: LegalSection[] = [
  {
    heading: "How the shop works",
    body: [
      `The ${site.name} shop is a showcase. It shows the clothing our Roblox group has made - shirts, t-shirts and pants for your avatar - and links you to each item on Roblox, where you buy it.`,
      "We take no payment on this website. There is no checkout here, no card details, and no Robux handled by us. Every purchase happens on Roblox's own catalog page, in Robux, through Roblox.",
    ],
  },
  {
    heading: "Who you are buying from",
    body: [
      "When you buy one of these items you are buying it on Roblox, from our Roblox group, under Roblox's terms. The Robux goes to Roblox, and Roblox records the sale.",
      "That means Roblox's terms of use and Roblox's rules on purchases and refunds govern the transaction - not this website. If you need help with a purchase, a charge, or a refund, that is a Roblox matter and Roblox is who can act on it.",
    ],
  },
  {
    heading: "Refunds",
    body: [
      "Because we never take your payment, we cannot issue a refund - there is nothing for us to refund. The money did not come to us.",
      "Roblox digital items are generally non-refundable, and any exception is Roblox's to make under their own policy. If you believe a purchase was wrong - you were charged twice, or bought the wrong item - raise it with Roblox through their support, since they hold the transaction.",
      "Prices are set on Roblox and can change there at any time. What you pay is whatever the item costs on its Roblox catalog page at the moment you buy it, which is the price that counts - not any figure that may be cached on a showcase page here.",
    ],
  },
  {
    heading: "What you're getting",
    body: [
      "These are Roblox clothing items - a texture that wraps onto your avatar and can be worn in any Roblox experience. They are digital, they live on your Roblox account, and there is nothing physical to ship.",
      "The 3D previews and images here are to show you the design. The item itself is delivered by Roblox to your account on purchase.",
    ],
  },
  {
    heading: "Tribute and fan collections",
    body: [
      "Some collections are fan-made tribute merchandise themed around real-world artists. They are unofficial: not affiliated with, endorsed by, or connected to the artist, their management or their label, and no official music, artwork or branding is used. Each such collection says so on its own page.",
    ],
  },
  {
    heading: "If something here is wrong",
    body: [
      "The purchase itself is Roblox's - but the showcase is ours. If a product page here is broken, links to the wrong item, or shows a price that no longer matches Roblox, that is our bug and we want to know.",
      `Tell us on the contact page, or email ${site.contactEmail}, and we will fix the listing.`,
    ],
  },
  {
    heading: "Changes to this policy",
    body: [
      "If the shop starts working differently - for instance, if we ever sell anything directly rather than handing off to Roblox - we will update this page and the date at the top of it before we do.",
    ],
  },
];

export default function RefundsPage() {
  return (
    <LegalDoc
      title="Merch & Refunds"
      updated={legalUpdated("/legal/refunds")}
      currentHref="/legal/refunds"
      intro="The shop is a showcase that hands off to Roblox. Every purchase happens on Roblox, in Robux, under Roblox's terms - so we take no payment and cannot issue refunds. Here's what that means, plainly."
      sections={sections}
    />
  );
}

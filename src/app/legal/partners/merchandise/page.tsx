import type { Metadata } from "next";
import { LegalDoc, partnerNav, type LegalSection } from "@/components/legal-doc";
import { site } from "@/lib/site";
import { legalUpdated } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Partner Merchandise Agreement",
  description:
    "How RO. Nation LIVE sells a partner's merchandise, and how each sale is split - Roblox takes 30%, we keep 10% of what remains, the partner keeps 90%.",
};

// One of the three partner agreements. The money clause here is load-bearing and must
// match what the accounting system actually does: Roblox tax is 30%, the post-tax profit
// is the 70% RNL receives, and the split of THAT is 10% to RNL, 90% to the partner. The
// same three numbers appear in the Ticketing agreement - if one moves, move both.

const sections: LegalSection[] = [
  {
    heading: "What this covers",
    body: [
      "This agreement lets us sell your merchandise - your items, their designs and artwork - through our storefront and our official channels.",
      "It is one of the documents you accept when you become a partner, alongside the [Asset Usage](/legal/partners/assets) and [Ticketing & Packages](/legal/partners/ticketing) agreements.",
    ],
  },
  {
    heading: "Permission to sell",
    body: [
      "You give us permission to list, present, market and sell your merchandise through our official channels.",
      "This permission is non-exclusive: you are free to sell your merchandise elsewhere as well.",
      "We decide how your merchandise is presented within our channels. You supply the items, the designs, and any assets we need to list them - the [Asset Usage](/legal/partners/assets) agreement covers how we use those.",
    ],
  },
  {
    heading: "How each sale is split",
    body: [
      "Every sale on Roblox has Roblox's own platform fee taken off the top first - its tax, currently 30% of the sale price. What is left is the post-tax profit.",
      "We keep 10% of the post-tax profit. You keep the other 90%.",
      "If Roblox changes its tax rate, the post-tax profit is worked out at whatever the rate is when the sale happens. Our 10% and your 90% of it do not change.",
      "Worked example, on a R$100 sale:",
    ],
    list: [
      "Sale price - R$100",
      "Roblox Tax, 30% - less R$30",
      "Post-tax profit - R$70",
      "Our share, 10% of R$70 - R$7",
      "Your share, 90% of R$70 - R$63",
    ],
  },
  {
    heading: "How you are paid",
    body: [
      "We hold your share and keep a record of it as it builds up.",
      "You are paid your share in full - either on request, whenever you ask, or automatically each month. Whichever you prefer.",
      "We pay in Robux (R$) to the account you nominate, or another way we agree in writing.",
      "You get a statement showing the sales, the post-tax profit, and your share.",
    ],
  },
  {
    heading: "Who owns what",
    body: [
      "You stay the owner of your merchandise and its designs. This agreement is permission to sell, not a transfer of ownership.",
      "So that we can sell it, you give us a limited, revocable licence to reproduce and display your merchandise and its designs within our channels - and nothing more.",
    ],
  },
  {
    heading: "Ending this agreement",
    body: [
      "This agreement runs until it is ended. Either of us can end it by giving the other reasonable notice.",
      "When it ends, we stop listing your merchandise. Any share you have already earned but not yet been paid is still yours, and we pay it as above.",
    ],
  },
  {
    heading: "Changes to this agreement",
    body: [
      "Any change to this agreement is something we both agree in writing. If we revise it, we update the date at the top of this page.",
    ],
  },
];

export default function PartnerMerchandisePage() {
  return (
    <LegalDoc
      title="Partner Merchandise Agreement"
      updated={legalUpdated("/legal/partners/merchandise")}
      currentHref="/legal/partners/merchandise"
      intro={`One of the agreements you accept when you become a partner of ${site.name}. It covers how we sell your merchandise, and how the money from each sale is split between us.`}
      sections={sections}
      nav={partnerNav}
    />
  );
}

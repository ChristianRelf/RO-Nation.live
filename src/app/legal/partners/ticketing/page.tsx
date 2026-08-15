import type { Metadata } from "next";
import { LegalDoc, partnerNav, type LegalSection } from "@/components/legal-doc";
import { site } from "@/lib/site";
import { legalUpdated } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Partner Ticketing & Packages Agreement",
  description:
    "RO. Nation LIVE sells all of a partner's tickets and packages through its official channels, splits each sale the same way, and pays the partner monthly.",
};

// The money clause here mirrors the Merchandise agreement exactly: 30% Roblox tax, then a
// 10% / 90% split of the post-tax profit. Keep the two in step.

const sections: LegalSection[] = [
  {
    heading: "What this covers",
    body: [
      "We run the ticketing for your events - selling tickets, and packages (bundles and upgrades, like VIP) - through our official channels. This agreement covers that, how the money from each sale is split, and how you are paid.",
      "It is one of the documents you accept when you become a partner, alongside the [Merchandise](/legal/partners/merchandise) and [Asset Usage](/legal/partners/assets) agreements.",
    ],
  },
  {
    heading: "Sold through us",
    body: [
      "All tickets and packages for your events are sold exclusively through our official channels.",
      "They are sold as our own Roblox products, through our own Roblox account, so all the Robux from a sale comes to us first - and we then pay you your share each month, as set out below.",
      "While this agreement is in force, you do not sell, resell or issue tickets or packages for your events anywhere else, and you do not authorise anyone else to.",
      "We handle issuing, delivering and validating tickets and packages through our channels.",
    ],
  },
  {
    heading: "How each sale is split",
    body: [
      "Every sale on Roblox has Roblox's own platform fee taken off the top first - its tax, currently 30% of the sale price. What is left is the post-tax profit.",
      "We keep 10% of the post-tax profit. You keep the other 90%.",
      "If Roblox changes its tax rate, the post-tax profit is worked out at whatever the rate is when the sale happens. Our 10% and your 90% of it do not change.",
      "Worked example, on a R$100 ticket:",
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
      "We hold your share and keep a record of it as it builds up. Holding it is not us keeping it - it is yours from the moment it is earned, and nothing about it expires.",
      "Each month we issue you a statement showing the sales, the post-tax profit and your share, and it is payable in full. **Issuing a statement does not send the Robux**: the amount is held until you ask for it.",
      "To ask, sign in at pay.ronation.live and request the funds against the statement. We pay in Robux (R$), by Roblox group payout to the account you nominate, or another way we agree in writing. If you would rather be paid automatically each month without asking, we will agree that with you in writing and it happens that way instead.",
      "If a sale is refunded or reversed, we adjust the shares in the next statement, or by a credit note against one already issued.",
      "The mechanics of all of this - the documents, the request, how an error is corrected - are set out in [Payments & Payouts](/legal/payments).",
    ],
  },
  {
    heading: "Ending this agreement",
    body: [
      "This agreement runs until it is ended. Either of us can end it by giving the other reasonable notice.",
      "When it ends, we stop selling new tickets and packages for your events. Tickets and packages already sold stay valid for the events they were sold for, and any share you have earned but not yet been paid is still yours.",
    ],
  },
  {
    heading: "Changes to this agreement",
    body: [
      "Any change to this agreement is something we both agree in writing. If we revise it, we update the date at the top of this page.",
    ],
  },
];

export default function PartnerTicketingPage() {
  return (
    <LegalDoc
      title="Partner Ticketing & Packages Agreement"
      updated={legalUpdated("/legal/partners/ticketing")}
      currentHref="/legal/partners/ticketing"
      intro={`One of the agreements you accept when you become a partner of ${site.name}. It covers how we sell tickets and packages for your events, and how the money is split between us.`}
      sections={sections}
      nav={partnerNav}
    />
  );
}

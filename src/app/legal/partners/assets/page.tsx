import type { Metadata } from "next";
import { LegalDoc, partnerNav, type LegalSection } from "@/components/legal-doc";
import { site } from "@/lib/site";
import { legalUpdated } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Partner Asset Usage Agreement",
  description:
    "The assets of a partner's that RO. Nation LIVE may use, what for, and the limits on that use - the partner keeps ownership and stays in control.",
};

const sections: LegalSection[] = [
  {
    heading: "What this covers",
    body: [
      "Working together, we sometimes need to use your assets - logos, artwork, 3D models, audio, brand names and other brand materials - to promote, stage and sell your shows, merchandise and packages. Throughout this document, that is the permitted purpose.",
      "Because we sell your merch and tickets through our own Roblox store and products (see the [Merchandise](/legal/partners/merchandise) and [Ticketing & Packages](/legal/partners/ticketing) agreements), the permitted purpose includes uploading and reproducing your assets on our own Roblox account for that sale.",
      "It is one of the documents you accept when you become a partner, alongside the [Merchandise](/legal/partners/merchandise) and [Ticketing & Packages](/legal/partners/ticketing) agreements.",
    ],
  },
  {
    heading: "What we may ask for",
    body: [
      "We may ask to use your assets for the permitted purpose. A request tells you which asset, and what it is for - and you can grant it or turn it down.",
      "We only ever use the assets you have made available. We do not take or use anything you have not agreed to.",
    ],
  },
  {
    heading: "Within reason - the limits",
    body: ["We use your assets only for the permitted purpose. In particular, we do not:"],
    list: [
      "sell an asset, or license it to anyone else, on its own;",
      "change an asset beyond what is needed to present it - resizing it, or placing it in a layout - without your agreement; or",
      "use an asset for anything unrelated to the partnership without your separate agreement.",
    ],
  },
  {
    heading: "Who owns what",
    body: [
      "You keep ownership of every asset. Nothing here transfers ownership to us.",
      "You give us a limited, non-exclusive, revocable licence to use your assets for the permitted purpose - and nothing more.",
    ],
  },
  {
    heading: "You stay in control",
    body: [
      "You can turn down any request, without giving a reason.",
      "You can withdraw an asset from use at any time, on reasonable notice. When you do, we stop using it as soon as we reasonably can, and remove it from anything still within our control.",
      "Withdrawing an asset does not, by itself, mean we can pull back something already published to other people - a post that has already gone out - but we do not keep publishing it anew.",
    ],
  },
  {
    heading: "Credit",
    body: [
      "Where we use an asset publicly, we credit you, unless we agree otherwise for a particular use.",
    ],
  },
  {
    heading: "Ending this agreement",
    body: [
      "This agreement runs until it is ended. Either of us can end it by giving the other reasonable notice. When it ends, the licence above ends, and we stop using your assets.",
    ],
  },
  {
    heading: "Changes to this agreement",
    body: [
      "Any change to this agreement is something we both agree in writing. If we revise it, we update the date at the top of this page.",
    ],
  },
];

export default function PartnerAssetsPage() {
  return (
    <LegalDoc
      title="Partner Asset Usage Agreement"
      updated={legalUpdated("/legal/partners/assets")}
      currentHref="/legal/partners/assets"
      intro={`One of the agreements you accept when you become a partner of ${site.name}. It covers the assets of yours we may use, what we may use them for, and the limits on that.`}
      sections={sections}
      nav={partnerNav}
    />
  );
}

import type { Metadata } from "next";
import { LegalDoc, type LegalSection } from "@/components/legal-doc";
import { site } from "@/lib/site";
import { legalUpdated } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Accessibility Notice",
  description:
    "What RO. Nation LIVE aims for on accessibility, what we know is not there yet, and how to tell us when something on the site is in your way.",
};

// An honest accessibility statement, not a compliance badge.
//
// The rule for this page is the same as for the Privacy Policy: say what is true. We aim
// at WCAG 2.1 AA and build towards it, but the site has not been through a formal
// third-party audit, so this does NOT claim conformance - it states the target, names the
// parts we know are weak, and gives a real route to report a barrier. A statement that
// over-claims is worse than none: it tells a disabled visitor the door is open when it is
// not.

const sections: LegalSection[] = [
  {
    heading: "What we're aiming for",
    body: [
      `${site.name} should be usable by as many people as possible, however you browse. We build towards the Web Content Accessibility Guidelines (WCAG) 2.1 at level AA as our standard, and we treat a barrier on the site as a bug to fix rather than a fact to live with.`,
      "We are being deliberate about the words here: this is the target we build to, not a certificate. The site has not been through a formal third-party accessibility audit, so we describe what we do and what we know is missing rather than claim a clean bill of health.",
    ],
  },
  {
    heading: "What we do",
    body: ["Concretely, across the site we try to:"],
    list: [
      "Use real, semantic HTML - headings, lists, buttons and links that mean what they are - so assistive technology can make sense of a page.",
      "Keep the site usable with a keyboard alone, with a visible focus outline so you can see where you are.",
      "Respect your system settings, including reduced-motion and light or dark preference.",
      "Aim for text and controls that meet AA colour contrast, and size that stays readable when you zoom.",
      "Write link and button text that says where it goes, rather than 'click here'.",
      "Give images that carry meaning a text alternative.",
    ],
  },
  {
    heading: "Where we know we fall short",
    body: [
      "Being honest is part of the point. Some things we already know are not fully there:",
    ],
    list: [
      "Some interactive pieces - the seat picker and a few dense tables in the staff and partner portals - have had less accessibility attention than the public pages, and may be harder to use with a screen reader.",
      "A handful of images, especially in older blog posts and on partner sites, may be missing good alternative text.",
      "Content that lives on partner subdomains is written by each partner's crew, so its quality can vary even though it runs on the same accessible framework.",
      "The events themselves happen inside Roblox, whose accessibility we do not control. This notice covers our websites, not the experience inside a Roblox game.",
    ],
  },
  {
    heading: "Tell us what's in your way",
    body: [
      "If something on the site stops you doing what you came to do - reserving a ticket, reading a page, using the portal - we want to hear about it, and we will treat it as a real problem to fix.",
      "It helps if you can tell us the page you were on, what you were trying to do, what got in the way, and the browser or assistive technology you were using - but do not let a missing detail stop you writing. Even 'this page doesn't work with my screen reader' is enough to start.",
      `Reach us on the contact page, or email ${site.contactEmail}. We will reply, and if we cannot fix something quickly we will tell you honestly and try to find another way to get you what you needed.`,
    ],
  },
  {
    heading: "Changes to this notice",
    body: [
      "As we fix things and find new ones, we update this page and the date at the top of it. When we can point to a formal audit rather than a target, this page will say so.",
    ],
  },
];

export default function AccessibilityNoticePage() {
  return (
    <LegalDoc
      title="Accessibility Notice"
      updated={legalUpdated("/legal/accessibility")}
      currentHref="/legal/accessibility"
      intro="What we aim for, what we know is not there yet, and how to tell us when something on the site is in your way. We would rather be honest about a gap than hide it behind a badge."
      sections={sections}
    />
  );
}

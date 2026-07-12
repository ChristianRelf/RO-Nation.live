import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal-doc";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that govern reserving and using RO. Nation LIVE tickets and this website.",
};

const sections = [
  {
    heading: "Acceptance",
    body: [
      `By using this website and reserving a ticket, you agree to these terms. If you don't agree, please don't reserve a ticket. These terms apply alongside our Privacy Policy and Code of Conduct.`,
    ],
  },
  {
    heading: "Your ticket",
    body: [
      "Every ticket is free and admits one person. A ticket is tied to your Roblox account — it can't be transferred, sold, or used by anyone else.",
      "Entry is verified in-experience at the door using your ticket code and account. Make sure you're signed in with the same Roblox account you reserved with.",
    ],
  },
  {
    heading: "Reservations and capacity",
    body: [
      "Tickets are subject to availability and event capacity. Reserving a ticket holds a spot for you; activating it prepares it for entry.",
      "Reserving tickets you don't use may affect your priority for future events. Please cancel a ticket you no longer need so someone else can take the spot.",
    ],
  },
  {
    heading: "Changes and cancellations",
    body: [
      `${site.name} may cancel, reschedule, or change the venue, line-up or format of any event. Where possible we'll announce changes ahead of time through our channels.`,
      "You may cancel your own ticket at any time from your tickets page.",
    ],
  },
  {
    heading: "Conduct",
    body: [
      "While attending our events you agree to follow the Roblox Community Standards and our own Code of Conduct. We may refuse entry or remove anyone who breaks these rules, without notice.",
    ],
  },
  {
    heading: "No warranty",
    body: [
      "Our events take place inside Roblox and depend on the Roblox platform, which we don't control. We provide the service 'as is' and can't guarantee uninterrupted availability of any experience or event.",
    ],
  },
  {
    heading: "Contact",
    body: [
      `Questions about these terms? Reach us via the contact page or email ${site.contactEmail}.`,
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      updated="6 July 2026"
      currentHref="/legal/terms"
      intro="These terms cover reserving and using tickets, and attending our events. They're written to be readable — no dense legalese."
      sections={sections}
    />
  );
}

import type { Metadata } from "next";
import { LegalDoc, robloxNav } from "@/components/legal-doc";
import { site } from "@/lib/site";
import { legalUpdated } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Roblox Integration - Terms of Service",
  description:
    "The terms that govern signing in with Roblox and using RO. Nation LIVE tickets and events.",
};

const sections = [
  {
    heading: "Acceptance",
    body: [
      `These terms govern your use of the ${site.name} website and its Roblox sign-in. By signing in with your Roblox account, you agree to them. If you do not agree, do not sign in.`,
      "They sit alongside our general Terms of Service, Privacy Policy and Code of Conduct.",
    ],
  },
  {
    heading: "Our relationship with Roblox",
    body: [
      "We are an independent event group operating inside Roblox. We are not affiliated with, endorsed by, or sponsored by Roblox Corporation.",
      "Your Roblox account remains governed by the Roblox Terms of Use and Community Standards. Nothing here overrides them, and where the two conflict, Roblox's rules take precedence on their platform.",
    ],
  },
  {
    heading: "Signing in",
    body: [
      "We use Roblox's official OAuth 2.0 sign-in. We never ask for, receive, or store your Roblox password, and we will never ask you for it - anyone who does is not us.",
      "You must sign in with your own Roblox account. Do not use someone else's account, and do not let someone else use yours to obtain a ticket.",
      "You are responsible for keeping your Roblox account secure. Anything done through a signed-in session is treated as done by you.",
    ],
  },
  {
    heading: "Tickets",
    body: [
      "Tickets are free and admit one person. A ticket is bound to the Roblox account that reserved it: it cannot be transferred, sold, traded, or used by anyone else.",
      "Entry is verified inside our Roblox experience against your ticket and your account, so you must attend signed in as the same account you reserved with.",
      "Tickets are subject to capacity. If you no longer need one, please cancel it so that someone else can take the place.",
    ],
  },
  {
    heading: "Event access and removal",
    body: [
      "We maintain a VIP list and a blacklist of Roblox players in order to run our events safely.",
      "We may refuse entry to, remove from an event, or bar any player who breaks the Roblox Community Standards or our Code of Conduct - including harassment, exploiting, disruption, or attempting to circumvent ticketing.",
      "If you believe you have been barred in error, contact us and we will review it.",
    ],
  },
  {
    heading: "Acceptable use",
    body: [
      "Do not attempt to break, overload, or gain unauthorised access to this website, our accounts, or our in-experience systems.",
      "Do not scrape, automate, or bulk-reserve tickets, and do not attempt to forge or reuse ticket codes.",
    ],
  },
  {
    heading: "Changes to events",
    body: [
      `${site.name} may cancel, reschedule, or change the venue, line-up or format of any event. Where we can, we will announce changes in advance through our channels.`,
    ],
  },
  {
    heading: "No warranty",
    body: [
      "Our events run inside Roblox, on infrastructure we do not control. The website and our events are provided 'as is', and we cannot guarantee uninterrupted availability of any experience, event, or ticket.",
      "Tickets are free, and to the fullest extent permitted by law we are not liable for losses arising from a cancelled, changed, or unavailable event.",
    ],
  },
  {
    heading: "Ending access",
    body: [
      "You may stop using the service at any time, cancel your tickets, and revoke this website's access from your Roblox account settings.",
      "We may suspend or end your access if you breach these terms.",
    ],
  },
  {
    heading: "Contact",
    body: [
      `Questions about these terms? Use the contact page or email ${site.contactEmail}.`,
    ],
  },
];

export default function RobloxTermsPage() {
  return (
    <LegalDoc
      title="Roblox Integration - Terms of Service"
      updated={legalUpdated("/legal/roblox/terms")}
      currentHref="/legal/roblox/terms"
      nav={robloxNav}
      intro="These are the terms you accept when you sign in with Roblox and reserve a ticket for one of our events."
      sections={sections}
    />
  );
}

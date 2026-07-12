import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal-doc";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How RO. Nation LIVE collects, uses and protects your data when you sign in with Roblox and reserve tickets.",
};

const sections = [
  {
    heading: "Who we are",
    body: [
      `${site.name} is a Roblox event management group. This policy explains what data we collect when you use this website to sign in and reserve tickets, why we collect it, and the choices you have.`,
      "We are not affiliated with or endorsed by Roblox Corporation. Your use of Roblox itself is governed by Roblox's own privacy policy and terms.",
    ],
  },
  {
    heading: "What we collect",
    body: [
      "When you sign in with Roblox we receive basic identity details from Roblox: your Roblox user ID, username, display name, and avatar image. We store these to create your account and show your tickets back to you.",
      "When you reserve a ticket we store the event, a unique ticket code, and timestamps for when you accepted the ticket terms, when you activated the ticket, and (if applicable) when you were checked in at an event.",
      "If you apply for a role we store the details you enter on the application form, such as your Roblox username, Discord handle, timezone, portfolio link and message.",
      "We do not collect payment information — all tickets are free.",
    ],
  },
  {
    heading: "How we use your data",
    body: [
      "We use your data to run the ticketing service: verifying who you are, showing your tickets, checking tickets at the door inside our Roblox experiences, and managing event capacity.",
      "We use application data solely to review and respond to your interest in joining the crew.",
      "We may use aggregate, non-identifying figures (such as total attendance) to plan and improve events.",
    ],
  },
  {
    heading: "Sharing",
    body: [
      "We do not sell your data. Ticket details may be shared with event staff and our in-experience door-verification system for the sole purpose of admitting you to an event.",
      "We may disclose information if required to comply with the law or to protect the safety of our community.",
    ],
  },
  {
    heading: "Retention",
    body: [
      "We keep account and ticket data for as long as your account is active or as needed to run events. You can ask us to delete your account and associated tickets at any time.",
    ],
  },
  {
    heading: "Your choices",
    body: [
      "You can cancel a ticket at any time from your tickets page. You can request access to, correction of, or deletion of your data by contacting us.",
      `To make a request, reach out via the contact page or email ${site.contactEmail}.`,
    ],
  },
  {
    heading: "Changes to this policy",
    body: [
      "We may update this policy from time to time. When we do, we'll revise the 'last updated' date at the top of this page.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated="6 July 2026"
      currentHref="/legal/privacy"
      intro="Your privacy matters. This page explains, in plain language, what we collect and why."
      sections={sections}
    />
  );
}

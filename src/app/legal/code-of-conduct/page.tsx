import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal-doc";

export const metadata: Metadata = {
  title: "Code of Conduct",
  description:
    "The community rules everyone agrees to follow at RO. Nation LIVE events.",
};

const sections = [
  {
    heading: "The short version",
    body: [
      "Come to have a good time and let everyone else do the same. Be respectful, keep it safe, and follow staff instructions. That's most of it.",
    ],
  },
  {
    heading: "Respect everyone",
    body: [
      "No harassment, hate speech, discrimination, threats, or bullying of any kind - toward attendees, performers, or crew. Treat people the way you'd want to be treated on the floor.",
    ],
  },
  {
    heading: "Keep it safe and clean",
    body: [
      "No exploiting, cheating, or attempting to disrupt the experience, the event, or our verification systems. No sharing of inappropriate content. Keep chat and behaviour suitable for a mixed audience.",
    ],
  },
  {
    heading: "Follow Roblox's rules",
    body: [
      "Our events run inside Roblox, so the Roblox Community Standards always apply. Anything that would get you moderated on Roblox will get you removed from our events too.",
    ],
  },
  {
    heading: "Listen to staff",
    body: [
      "Our moderators and hosts keep events running smoothly. Follow their instructions. They can mute, remove, or ban anyone who breaks these rules - at their discretion and without warning.",
    ],
  },
  {
    heading: "Reporting",
    body: [
      "If you see something that breaks these rules, tell a moderator in-experience or report it in our Discord support channel. We take reports seriously and act on them quickly.",
    ],
  },
  {
    heading: "Consequences",
    body: [
      "Breaking this code can mean removal from an event, cancellation of your tickets, and a ban from future events. Serious breaches may be reported to Roblox.",
    ],
  },
];

export default function CodeOfConductPage() {
  return (
    <LegalDoc
      title="Code of Conduct"
      updated="6 July 2026"
      currentHref="/legal/code-of-conduct"
      intro="Everyone who attends our events agrees to these rules. They exist to keep our shows safe, welcoming and fun for the whole crowd."
      sections={sections}
    />
  );
}

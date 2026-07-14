import type { Metadata } from "next";
import { LegalDoc, discordNav } from "@/components/legal-doc";
import { site } from "@/lib/site";
import { legalUpdated } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Discord Integration - Privacy Policy",
  description:
    "What data RO. Nation LIVE receives from Discord when staff sign in to the SHASHA portal, and how it is used.",
};

const sections = [
  {
    heading: "Who we are, and what this covers",
    body: [
      `${site.name} is a Roblox event management group. This policy covers our Discord integration specifically: the "Sign in with Discord" button on our staff portal.`,
      "The Discord sign-in exists for one purpose - to identify members of our staff so they can access an internal tool. It is not a public login, and it is not used anywhere else on our website.",
      "We are an independent group. We are not affiliated with, endorsed by, or sponsored by Discord Inc. Discord's own Privacy Policy governs your use of Discord itself.",
    ],
  },
  {
    heading: "What Discord tells us when you sign in",
    body: [
      "We use Discord's OAuth 2.0 sign-in and request a single scope: 'identify'. Discord sends us your Discord user ID, your username, your display name, and your avatar image.",
      "That is all we receive. We do not get your email address, and we do not request the 'email' scope.",
      "We cannot read your messages or direct messages. We cannot see which servers you are in. We cannot post, act, or make any change on your behalf anywhere on Discord. We never see your Discord password.",
    ],
  },
  {
    heading: "What we store, and why",
    body: [
      "Your session: when you sign in, your Discord user ID, username, display name and avatar are placed in a signed cookie in your browser so that you stay signed in. This cookie is HTTP-only, so scripts in your browser cannot read it, and it expires after 7 days.",
      "Accountability records: our staff portal holds a VIP list and a blacklist of Roblox players. When you add, edit, or remove someone, we store your Discord user ID and display name alongside that change, together with the reason you gave and the time you made it.",
      "We keep those records so that decisions about who is granted access to, or barred from, our events can be traced back to the person who made them.",
      "We do not build a marketing profile of you, we do not use your data for advertising, and we do not sell it or share it with data brokers.",
    ],
  },
  {
    heading: "Who can sign in",
    body: [
      "Access to the portal is restricted to an explicit list of approved Discord user IDs held in our server configuration. A valid Discord login is not enough on its own.",
      "If your Discord account is not on that list, we do not create any record of you: the sign-in is refused and nothing is stored.",
    ],
  },
  {
    heading: "Who can see it",
    body: [
      "The change history is visible only to other authorised staff inside the portal.",
      "We may disclose information where the law requires it, or where it is necessary to protect the safety of our community.",
    ],
  },
  {
    heading: "How long we keep it",
    body: [
      "Your sign-in session lasts 7 days, and ends immediately when you sign out.",
      "Accountability records are retained for as long as we run events, because their whole purpose is to keep a durable record of who decided what. Removing your access does not erase changes you already made.",
    ],
  },
  {
    heading: "Your choices",
    body: [
      "You can sign out at any time, which clears the session cookie.",
      "You can revoke this application's access from Discord at any time: User Settings → Authorised Apps.",
      "You can ask us for a copy of the data we hold about you, ask us to correct it, or ask us to remove your access.",
      `To make a request, use the contact page or email ${site.contactEmail}.`,
    ],
  },
  {
    heading: "Changes to this policy",
    body: [
      "If we change this policy we will update the 'last updated' date at the top of this page.",
    ],
  },
];

export default function DiscordPrivacyPage() {
  return (
    <LegalDoc
      title="Discord Integration - Privacy Policy"
      updated={legalUpdated("/legal/discord/privacy")}
      currentHref="/legal/discord/privacy"
      nav={discordNav}
      intro="Our Discord sign-in is used only to identify staff for an internal tool. This page explains precisely what Discord shares with us, and what we keep."
      sections={sections}
    />
  );
}

import type { Metadata } from "next";
import { LegalDoc, robloxNav } from "@/components/legal-doc";
import { site } from "@/lib/site";
import { legalUpdated } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Roblox Integration - Privacy Policy",
  description:
    "What data RO. Nation LIVE receives from Roblox when you sign in, why we hold it, and how to have it deleted.",
};

const sections = [
  {
    heading: "Who we are",
    body: [
      `${site.name} is a Roblox event management group. This policy covers our Roblox integration specifically: what we receive from Roblox when you sign in with your Roblox account, and what we do with it.`,
      "We are an independent group. We are not affiliated with, endorsed by, or sponsored by Roblox Corporation. Roblox's own Privacy Policy governs your use of Roblox itself.",
    ],
  },
  {
    heading: "What Roblox tells us when you sign in",
    body: [
      "We use Roblox's official OAuth 2.0 sign-in with the 'openid' and 'profile' scopes. Roblox sends us only your basic public profile: your Roblox user ID, your username, your display name, your avatar image, and a link to your profile.",
      "We never see or receive your Roblox password. We do not receive your email address, your date of birth, your friends list, your messages, your Robux balance, or any other account details.",
      "We cannot act on your behalf on Roblox. The sign-in is read-only identification - it gives us no ability to change anything on your Roblox account.",
    ],
  },
  {
    heading: "What we store, and why",
    body: [
      "Account: your Roblox user ID, username, display name and avatar. We store these so we can create your account here, show you your tickets, and greet you by name.",
      "Tickets: which event a ticket is for, its unique ticket code, and timestamps for when you reserved it, accepted the ticket terms, activated it, and were checked in at the door.",
      "Applications: if you apply for a role, whatever you type into the application form - such as your Roblox username, Discord handle, timezone, portfolio link and message.",
      "Event access lists: our staff maintain a VIP list and a blacklist of Roblox players. If a member of staff adds you to one of these, we store your Roblox user ID, username, display name and avatar, the labels applied to you, and the reason recorded by the staff member. This information is looked up from Roblox's public user and thumbnail APIs - it does not require you to have signed in here.",
      "We do not collect payment information. All of our tickets are free.",
    ],
  },
  {
    heading: "How we use it",
    body: [
      "To run ticketing: identifying you, showing your tickets back to you, managing capacity, and verifying tickets at the door inside our Roblox experiences.",
      "To review applications from people who want to join the crew.",
      "To run our events safely: deciding who has VIP access and who is barred from attending.",
      "We do not use your data for advertising, and we do not sell it or share it with data brokers.",
    ],
  },
  {
    heading: "Who can see it",
    body: [
      "Your ticket details are visible to our event staff and to the door-verification system running inside our Roblox experiences, purely so you can be admitted.",
      "The VIP list and blacklist are visible only to authorised staff, who sign in to a separate, access-controlled portal. Every change to those lists is logged with the name of the staff member who made it.",
      "We may disclose information where the law requires it, or where it is necessary to protect the safety of our community.",
    ],
  },
  {
    heading: "Cookies",
    body: [
      "When you sign in we set a single cookie containing a signed session token, so that you stay signed in between visits. It is HTTP-only, meaning scripts in your browser cannot read it. It expires after 30 days, or immediately when you sign out.",
      "We do not use advertising or third-party tracking cookies.",
    ],
  },
  {
    heading: "How long we keep it",
    body: [
      "We keep your account and ticket history for as long as your account exists, so we can show you your past and upcoming events.",
      "Entries on the VIP list and blacklist are kept until a member of staff removes them, and the record of who changed the list and why is retained so that decisions stay accountable.",
    ],
  },
  {
    heading: "Your choices",
    body: [
      "You can cancel any ticket yourself from your tickets page at any time.",
      "You can ask us for a copy of the data we hold about you, ask us to correct it, or ask us to delete your account and its tickets.",
      "You can also revoke this website's access to your Roblox account at any time from your Roblox account settings. Doing so stops any future sign-ins; to have data already stored here removed, contact us.",
      `To make any of these requests, use the contact page or email ${site.contactEmail}.`,
    ],
  },
  {
    heading: "Changes to this policy",
    body: [
      "If we change this policy we will update the 'last updated' date at the top of this page.",
    ],
  },
];

export default function RobloxPrivacyPage() {
  return (
    <LegalDoc
      title="Roblox Integration - Privacy Policy"
      updated={legalUpdated("/legal/roblox/privacy")}
      currentHref="/legal/roblox/privacy"
      nav={robloxNav}
      intro="This policy explains exactly what we receive from Roblox when you sign in with your Roblox account, what we keep, and how to get it removed."
      sections={sections}
    />
  );
}

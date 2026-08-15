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
      "We use Roblox's official OAuth 2.0 sign-in. Ordinary sign-in asks for the 'openid' and 'profile' scopes and nothing else, so Roblox sends us only your basic public profile: your Roblox user ID, your username, your display name, your avatar image, and a link to your profile.",
      "We never see or receive your Roblox password. We do not receive your email address, your date of birth, your friends list, your messages, your Robux balance, or any other account details.",
      "We cannot act on your behalf on Roblox. Sign-in is read-only identification - it gives us no ability to change anything on your Roblox account.",
    ],
  },
  {
    heading: "The one extra permission, and when we ask",
    body: [
      "There is exactly one permission beyond sign-in that we ever ask for, and we ask for it separately, later, and only from the one place that needs it.",
      "Where a ticket tier is sold as a Roblox game pass, a buyer reaching that paid checkout is asked for 'user.inventory-item:read' - permission to check whether you own that pass. That check is the whole point: it is how we can issue a paid ticket to the person who actually bought it, rather than taking somebody's word for it.",
      "We ask at the checkout rather than at sign-in on purpose. Somebody who only ever takes a free ticket should never be shown a prompt asking about their inventory, and they are not.",
      "That permission is read-only and narrow. It lets us ask Roblox one question - do you own this pass - and it cannot spend Robux, see your balance, change your avatar, join a group, or post anything. You can decline it and still use the site; you simply cannot complete that particular purchase.",
      "If you grant it, Roblox gives us a token for it and we store that token, together with the list of permissions you actually granted, so we can make the check when it is needed. You can withdraw it at any time from your Roblox account settings, under the authorised applications for your account, and you can ask us to delete the stored token as well.",
    ],
  },
  {
    heading: "What we store, and why",
    body: [
      "Account: your Roblox user ID, username, display name and avatar. We store these so we can create your account here, show you your tickets, and greet you by name.",
      "Tickets: which event a ticket is for, its unique ticket code, and timestamps for when you reserved it, accepted the ticket terms, activated it, and were checked in at the door.",
      "Applications: if you apply for a role, whatever you type into the application form - such as your Roblox username, Discord handle, timezone, portfolio link and message.",
      "Event access lists: our staff maintain a VIP list and a blacklist of Roblox players. If a member of staff adds you to one of these, we store your Roblox user ID, username, display name and avatar, the labels applied to you, and the reason recorded by the staff member. This information is looked up from Roblox's public user and thumbnail APIs - it does not require you to have signed in here.",
      "Permission tokens, only if you granted the checkout permission described above: the tokens Roblox issues for it, and the list of permissions you actually granted.",
      "Purchases, where a ticket was paid for in Robux: Roblox's own purchase ID for the sale, the Robux it reported, and which Roblox place and product it happened in. That record is what stops the same purchase being counted twice.",
      "We never collect card or bank details, and there is no way to give us any - we have no checkout. Where a ticket is paid for, the payment is a Robux transaction taken by Roblox on Roblox, and all we ever see is that it happened.",
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
      "A permission grant is kept while it is useful for checking a pass you bought. Revoking it on Roblox, or asking us, ends that.",
      "A purchase record is kept as a financial record - it is the evidence that you paid for what you hold, and it is what a dispute about a charge would be settled from.",
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

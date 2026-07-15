import type { Metadata } from "next";
import { LegalDoc, discordBotNav } from "@/components/legal-doc";
import { site } from "@/lib/site";
import { legalUpdated } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Discord Bot - Privacy Policy",
  description:
    "What our Discord bot receives when you link your Roblox account to your Discord one, exactly what it stores, and how to unlink.",
};

// This policy describes what the BOT integration actually does - the code is in
// src/lib/discord-link.ts and src/app/api/v1/discord/link|unlink. It is a separate thing
// from the Discord SIGN-IN (that logs staff into the portal; this links a member's Roblox
// account to their Discord one). Keep the two straight, and keep this in step with the code:
// the bot stores a DiscordLink row - discordId, optional discordUsername, and the tie to a
// Roblox account - and nothing else.

const sections = [
  {
    heading: "What this covers",
    body: [
      `${site.name} runs a Discord bot. This policy covers that bot only: what it receives, what it stores, and what it does not touch.`,
      "This is not the same as signing in with Discord. Signing in with Discord logs a member of staff into our portal, and has its own privacy policy. The bot does one different thing: it links an ordinary member's Roblox account to their Discord account, so features that need to know 'which Roblox player is this Discord user?' can work.",
      "We are an independent event group. We are not affiliated with, endorsed by, or sponsored by Discord Inc. Your use of Discord itself is governed by Discord's own Privacy Policy.",
    ],
  },
  {
    heading: "How linking works",
    body: [
      "You start the link on our website, signed in with Roblox, at ronation.live/account/link. It shows you a short six-digit code that is valid for a few seconds.",
      "You give that code to the bot on Discord. The bot sends us the code together with the Discord user ID of whoever ran the command, and we tie that Discord account to your Roblox account. The code is single-use and expires almost immediately, so it cannot be reused or handed around.",
    ],
  },
  {
    heading: "What the bot receives",
    body: [
      "When you run the link command, the bot passes us your Discord user ID, and optionally your Discord username, alongside the code you entered.",
      "That is all. The bot requests no access to your messages or direct messages, does not read your servers, and cannot post or act on your behalf. We never see your Discord password.",
    ],
  },
  {
    heading: "What we store",
    body: [
      "If the code checks out, we store a single link record: your Discord user ID, your Discord username if the bot sent it, and the fact that it belongs to your Roblox account, with the time the link was made.",
      "We store nothing else from Discord. There is no message history, no server list, and no profile beyond the ID and username above.",
    ],
  },
  {
    heading: "What it is used for",
    body: [
      "The link lets features that span both platforms recognise you - for example, a bot command that answers 'who is this?' with your Roblox name, or keeping a Discord role in step with your standing in our community.",
      "We do not build a marketing profile from it, we do not use it for advertising, and we never sell it or hand it to data brokers.",
    ],
  },
  {
    heading: "Who can see it",
    body: [
      "The link record is used inside our own systems and our bot. It is not published.",
      "We may disclose information where the law requires it, or where it is necessary to protect someone's safety.",
    ],
  },
  {
    heading: "How long we keep it",
    body: [
      "The link lasts until it is removed. You can remove it yourself at any time - from ronation.live/account/link, or with the bot's unlink command - and re-linking simply overwrites the old record.",
      "The short codes themselves are never kept: a code is destroyed the moment it is used, and an unused one expires within seconds.",
    ],
  },
  {
    heading: "Your choices",
    body: [
      "Unlink whenever you like, from your account page or through the bot. Once unlinked, the record is gone.",
      "You can also ask us for a copy of what we hold, ask us to correct it, or ask us to delete it.",
      `To make a request, use the contact page or email ${site.contactEmail}.`,
    ],
  },
  {
    heading: "Changes to this policy",
    body: [
      "If we change what the bot receives or stores, we update this page and the date at the top of it.",
    ],
  },
];

export default function DiscordBotPrivacyPage() {
  return (
    <LegalDoc
      title="Discord Bot - Privacy Policy"
      updated={legalUpdated("/legal/discord/bot/privacy")}
      currentHref="/legal/discord/bot/privacy"
      nav={discordBotNav}
      intro="Our Discord bot links your Roblox account to your Discord one and nothing more. This page explains exactly what it receives from Discord, and what we keep."
      sections={sections}
    />
  );
}

import type { Metadata } from "next";
import { LegalDoc, discordBotNav } from "@/components/legal-doc";
import { site } from "@/lib/site";
import { legalUpdated } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Discord Bot - Terms of Service",
  description:
    "The terms for using the RO. Nation LIVE Discord bot and linking your Roblox account to your Discord one.",
};

// The terms for the bot integration. Same subject as the bot privacy policy, from the
// other side: what you agree to by using it. Keep it in step with what the bot can
// actually do (src/lib/discord-link.ts) - it links and unlinks a Roblox<->Discord pairing
// and answers "who is this", and it touches no tickets and no money.

const sections = [
  {
    heading: "Acceptance",
    body: [
      `These terms govern the ${site.name} Discord bot. By using the bot - in particular by linking your Roblox account to your Discord account with it - you agree to them.`,
      "They sit alongside our general Terms of Service, Privacy Policy and Code of Conduct, and the bot's own Privacy Policy.",
    ],
  },
  {
    heading: "Our relationship with Discord",
    body: [
      "We are an independent event group. We are not affiliated with, endorsed by, or sponsored by Discord Inc.",
      "Your Discord account remains governed by Discord's Terms of Service and Community Guidelines. Nothing here overrides them, and using the bot is also subject to the rules of the Discord server you use it in.",
    ],
  },
  {
    heading: "What the bot is for",
    body: [
      "The bot links your Roblox account to your Discord account, so features that need to know which Roblox player a Discord user is can work - a 'who is this' lookup, keeping a role in step with your standing, and similar.",
      "It is a convenience, not a service you are entitled to. We may change what it does, or take it offline, at any time.",
    ],
  },
  {
    heading: "Linking your account",
    body: [
      "To link, sign in with Roblox at ronation.live/account/link, read the short code it shows you to the bot, and the bot ties that Discord account to your Roblox one.",
      "Only link your own accounts. The code proves the Roblox account is yours; the Discord side is bound to whoever runs the command, so run it yourself and do not share a live code with anyone. A code you give away is a link somebody else can claim.",
    ],
  },
  {
    heading: "One Discord, one Roblox",
    body: [
      "A Discord account can be linked to a single Roblox account at a time. If you try to link a Discord account that is already tied to a different Roblox account, the bot refuses rather than moving it - the person who owns the existing link has to unlink it first.",
      "This is deliberate: it stops a link being pulled off the account that really owns it.",
    ],
  },
  {
    heading: "How you must use it",
    body: [
      "Do not use the bot to impersonate anyone, or to link an account that is not yours.",
      "Do not try to guess codes, flood the bot with link attempts, or otherwise interfere with it. Attempts are rate-limited, and abuse may cost you access.",
      "Do not use the bot, or anything it tells you, to harass another person.",
    ],
  },
  {
    heading: "Unlinking",
    body: [
      "You can unlink at any time - from ronation.live/account/link, or with the bot's unlink command. Once unlinked, the record is removed, and any feature that relied on the link simply stops recognising you until you link again.",
      "We may remove a link, or your access to the bot, if you breach these terms.",
    ],
  },
  {
    heading: "No warranty",
    body: [
      "The bot is provided 'as is'. It depends on Discord, Roblox and infrastructure we do not control, and we cannot guarantee it is always available or error-free.",
    ],
  },
  {
    heading: "Contact",
    body: [
      `Questions about these terms? Use the contact page or email ${site.contactEmail}.`,
    ],
  },
];

export default function DiscordBotTermsPage() {
  return (
    <LegalDoc
      title="Discord Bot - Terms of Service"
      updated={legalUpdated("/legal/discord/bot/terms")}
      currentHref="/legal/discord/bot/terms"
      nav={discordBotNav}
      intro="These are the terms you accept when you use our Discord bot and link your Roblox account to your Discord one."
      sections={sections}
    />
  );
}

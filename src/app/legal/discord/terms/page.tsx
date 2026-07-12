import type { Metadata } from "next";
import { LegalDoc, discordNav } from "@/components/legal-doc";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Discord Integration — Terms of Service",
  description:
    "The terms that govern signing in with Discord and using the RO. Nation LIVE staff portal.",
};

const sections = [
  {
    heading: "Acceptance",
    body: [
      `These terms govern the "Sign in with Discord" feature of the ${site.name} staff portal. By signing in with Discord, you agree to them.`,
      "They sit alongside our general Terms of Service, Privacy Policy and Code of Conduct.",
    ],
  },
  {
    heading: "Our relationship with Discord",
    body: [
      "We are an independent event group. We are not affiliated with, endorsed by, or sponsored by Discord Inc.",
      "Your Discord account remains governed by Discord's Terms of Service and Community Guidelines. Nothing here overrides them.",
    ],
  },
  {
    heading: "This is a staff tool",
    body: [
      "The portal is an internal tool for authorised members of our team. It is not a public service, and there is nothing here for general members of the public.",
      "Access is granted to an explicit list of approved Discord accounts. Signing in with a Discord account that is not on that list will simply be refused.",
      "Access is a permission, not an entitlement. We may grant, restrict, or withdraw it at any time, and it is withdrawn immediately when someone leaves the team.",
    ],
  },
  {
    heading: "Signing in",
    body: [
      "We use Discord's official OAuth 2.0 sign-in and request only the 'identify' scope. We never ask for, receive, or store your Discord password, and we will never ask you for it — anyone who does is not us.",
      "Sign in with your own Discord account, and do not share your session with anyone. Anything done through a signed-in session is treated as done by you, and is recorded against your name.",
    ],
  },
  {
    heading: "How you must use it",
    body: [
      "The portal holds a VIP list and a blacklist of Roblox players, including the reasons recorded against them. Treat it as confidential: do not share, publish, screenshot, or export its contents outside the team.",
      "Give an honest, specific reason for every change you make. Every addition, edit and removal is logged against your Discord account, permanently.",
      "Do not use the lists to harass anyone, and do not add people out of personal grievance. Blacklisting is for conduct at our events, not for settling scores.",
      "Do not attempt to gain access beyond the level you have been granted, or to interfere with the portal's security.",
    ],
  },
  {
    heading: "Accountability",
    body: [
      "Every change to the lists is recorded with your Discord user ID, your display name, the reason you gave, and the time. This record is retained even after your access ends.",
      "Misuse of the portal may result in your access being removed and, where appropriate, your removal from the team.",
    ],
  },
  {
    heading: "No warranty",
    body: [
      "The portal is provided 'as is'. It depends on Discord, Roblox and infrastructure we do not control, and we cannot guarantee uninterrupted availability.",
    ],
  },
  {
    heading: "Ending access",
    body: [
      "You may stop using the portal at any time, sign out, and revoke this application from Discord under User Settings → Authorised Apps.",
      "We may withdraw your access at any time, in particular if you breach these terms.",
    ],
  },
  {
    heading: "Contact",
    body: [
      `Questions about these terms? Use the contact page or email ${site.contactEmail}.`,
    ],
  },
];

export default function DiscordTermsPage() {
  return (
    <LegalDoc
      title="Discord Integration — Terms of Service"
      updated="12 July 2026"
      currentHref="/legal/discord/terms"
      nav={discordNav}
      intro="These are the terms you accept when you sign in to the staff portal with Discord."
      sections={sections}
    />
  );
}

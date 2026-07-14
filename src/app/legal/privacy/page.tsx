import type { Metadata } from "next";
import { LegalDoc, type LegalSection } from "@/components/legal-doc";
import { site } from "@/lib/site";
import { legalUpdated } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What RO. Nation LIVE collects when you sign in with Roblox, reserve a ticket, apply for the crew or answer a survey - why we hold it, who can see it, and how to get it removed.",
};

// This policy describes what the CODE actually does. Every item under "What we
// collect" maps to a real column in prisma/schema.prisma, and every claim about
// who can see what maps to a real guard (lib/company.ts, lib/shasha.ts,
// lib/partners/guard.ts).
//
// If you change what is stored, change this page in the same commit. A privacy
// policy that has drifted from the schema is worse than no policy: it is a
// promise you are quietly breaking.

const sections: LegalSection[] = [
  {
    heading: "Who this covers",
    body: [
      `${site.name} runs live shows, showcases and tournaments inside Roblox. This policy explains what we collect when you use our websites, why we hold it, who can see it, and how to get it changed or removed.`,
      "It applies to everything we operate - not just the main site:",
    ],
    list: [
      "ronation.live - the public site, tickets, blog, careers and your account.",
      "portal.ronation.live - the staff and partner portals, used by our crews.",
      "survey.ronation.live - surveys, answered with a Roblox sign-in.",
      "Partner sites on our subdomains (for example sleeptokenro.ronation.live). We host and operate these; a partner's own crew writes the content. Data collected there is held by us, under this policy.",
    ],
  },
  {
    heading: "We are not Roblox",
    body: [
      "We are an independent event group. We are not affiliated with, endorsed by, or operated by Roblox Corporation.",
      "What you do inside Roblox itself - your account, your chat, your purchases - is governed by Roblox's own privacy policy and terms, not by this one. We only ever see what Roblox chooses to hand us, and what you type into our forms.",
    ],
  },
  {
    heading: "Age",
    body: [
      "You must be 13 or over to sign in here, reserve a ticket, apply for a role or answer a survey. We cannot verify anybody's age, so this is a rule you agree to rather than a gate we can enforce.",
      "If you are under 13, please don't create an account with us. You can still come to the shows - they happen inside Roblox, and attending one is governed by Roblox's rules and by whatever your parent or guardian allows there.",
      "If we learn that an account here belongs to someone under 13, we delete it and the tickets attached to it.",
    ],
  },
  {
    heading: "What we collect",
    body: ["We hold only what the service actually needs. In full, that is:"],
    list: [
      "Your Roblox identity, when you sign in. Roblox hands us your user ID, username, display name and avatar picture. We never see your Roblox password.",
      "Your tickets - which event, a unique ticket code, which tier, and the timestamps for when you accepted the ticket terms, when you activated it, and when you were checked in at the door.",
      "Crew applications - the Roblox username, Discord handle, timezone, portfolio link and message you type into the form, plus the status we later set on it (New, Reviewing, Accepted, Rejected).",
      "Survey answers, tied to your Roblox account. That link is deliberate: it is how we keep a survey to one response per person. Whoever built the survey can see your answers alongside your account.",
      "VIP list and blacklist entries - if you are added to either, we hold your Roblox ID, username, display name, avatar, the reason recorded, who added you, and when. Changes are kept as an append-only history.",
      "Images uploaded by our staff or a partner's crew, along with which account uploaded them. Ordinary visitors cannot upload anything.",
      "Ordinary server logs - IP address, browser user-agent, timestamps - kept briefly for security and debugging.",
      "One session cookie. See below.",
    ],
  },
  {
    heading: "What we don't collect",
    body: ["It is worth being just as specific about this."],
    list: [
      "No passwords. Sign-in happens at Roblox; we never see or hold your credentials.",
      "No payment details. Every ticket you can reserve today is free, and we take no money on this site. See our Terms for how a future Robux tier would work - it would happen inside Roblox, not here.",
      "No advertising or analytics trackers. No third-party tracking cookies, no ad pixels, nothing sold or handed to data brokers.",
      "No message content from Roblox or Discord. We cannot read your chats.",
    ],
  },
  {
    heading: "Cookies",
    body: [
      "We use one cookie: a session cookie that remembers you are signed in. It holds a signed token identifying your account and nothing else, it cannot be read by scripts in your browser, and it is strictly necessary for the site to work. It lasts up to 30 days, or until you sign out.",
      "It is scoped to the exact hostname that set it. Signing in on the portal is not signing in on the main site, and signing in on a partner's site is not signing in on ours. That separation is deliberate.",
    ],
  },
  {
    heading: "Why we hold it",
    body: ["Each purpose is tied to something the service actually has to do:"],
    list: [
      "Running ticketing - confirming who you are, showing you your tickets, verifying them at the door inside the Roblox experience, and keeping a venue to its capacity.",
      "Reviewing crew applications, and getting back to you about them.",
      "Running surveys, and keeping them to one response per person.",
      "Keeping events safe - the blacklist exists so that somebody removed from a show for harming others can be kept out of the next one.",
      "Recognising VIPs and guests at the door.",
      "Security and abuse prevention: spotting exploit attempts against ticket verification, and keeping a change history so an action can be traced to whoever took it.",
      "Aggregate, non-identifying figures - how many people came - to plan future shows.",
    ],
  },
  {
    heading: "The blacklist and the VIP list",
    body: [
      "These get their own section, because they are the most sensitive thing we hold.",
      "If you are added to either list, we record who added you, when, and a short reason. The entry and its history are visible to the crew of the organisation holding that list - our staff for ours, a partner's crew for theirs - and to senior RO. Nation LIVE staff.",
      "They are used for one thing: deciding who gets into an event. They are never published, never used for anything else, and never shared outside the crew who need them.",
      "If you believe you are on a blacklist unfairly, contact us and ask for it to be reviewed. Tell us your Roblox username. We will look at the reason recorded, and either remove the entry or explain it.",
    ],
  },
  {
    heading: "Who can see your data",
    body: [
      "Access is decided by rank in our Roblox group, checked against Roblox on every request. It is not a list of accounts kept somewhere and forgotten: promoting somebody grants access, and demoting them takes it away within minutes.",
    ],
    list: [
      "Our senior staff can see the data behind our own site - tickets and attendees, applications, surveys, and our VIP list and blacklist.",
      "A partner's crew can see only their own organisation's data: their shows' ticket holders, applications sent to their roles, and their own VIP list and blacklist. They cannot see ours, and they cannot see another partner's.",
      "Senior RO. Nation LIVE staff can also open a partner's portal, because we build and run these sites for them.",
      "Our door system inside the Roblox experience is told whether a ticket code is valid and whose it is. That, and nothing else, is what admits you.",
    ],
  },
  {
    heading: "Who we share it with",
    body: [
      "We do not sell your data, and we do not share it for marketing. It leaves our systems in only these ways:",
    ],
    list: [
      "Roblox - we call their public APIs to look up a group rank or an avatar picture. That tells Roblox we asked about an account; it does not send them anything you typed here.",
      "Our hosting provider, which runs the server the site and its database sit on.",
      "Our own Roblox experiences, at the door, to verify a ticket.",
      "Where the law requires it, or where we believe it is necessary to protect somebody's safety.",
    ],
  },
  {
    heading: "Where it is stored",
    body: [
      "Your data lives in our own database, on our own server. Uploaded images sit on that server's disk. It is not scattered across third-party analytics or marketing platforms.",
      "That server may be in a different country from you. By using the site, you understand your data may be transferred to and processed there.",
    ],
  },
  {
    heading: "How long we keep it",
    body: ["Plainly:"],
    list: [
      "Your account - for as long as it exists. Ask, and we delete it.",
      "Tickets - kept after the event, so a dispute about who was admitted can be settled. They go when your account goes.",
      "Crew applications - kept while we consider them, and for a reasonable period afterwards so we can answer questions about a decision. Ask, and we delete yours.",
      "Survey answers - kept while the results are still useful. They stay linked to your account, because that link is what stops the same person answering twice.",
      "Blacklist entries - kept until the crew who added them removes them. That is the point of them; a blacklist that quietly expires protects nobody.",
      "Server logs - kept briefly, then discarded.",
    ],
  },
  {
    heading: "Your choices",
    body: [
      "You can cancel a ticket yourself, at any time, from your tickets page.",
      "You can ask us for a copy of what we hold about you, ask us to correct it, or ask us to delete it. Contact us and tell us your Roblox username, so we can find the right account.",
      "Two honest limits on deletion. We may keep a blacklist entry where removing it would put other people at risk - if you are on one, ask us to review it rather than to erase it. And we cannot un-count an aggregate figure, such as the attendance of a show that has already happened, because that number no longer identifies anybody.",
      `To make a request, use the contact page or email ${site.contactEmail}.`,
    ],
  },
  {
    heading: "Security",
    body: [
      "We hold no passwords, so there are none to leak - sign-in is handled entirely by Roblox.",
      "Sessions are signed tokens in a cookie your browser will not expose to scripts, scoped to a single hostname. Staff access is re-checked against your live Roblox group rank on every request, so removing somebody from the group removes their access. There is no stale account left behind to forget about.",
      "No system is perfectly secure and we will not pretend otherwise. If you find a vulnerability, please tell us before you tell anyone else.",
    ],
  },
  {
    heading: "Changes to this policy",
    body: [
      "If we change what we collect, or what we do with it, we update this page and the date at the top of it. If a change is significant we will say so in our community channels, rather than hoping you notice a date.",
    ],
  },
  {
    heading: "Contact",
    body: [
      `Questions, requests or complaints: use the contact page, or email ${site.contactEmail}.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated={legalUpdated("/legal/privacy")}
      currentHref="/legal/privacy"
      intro="What we collect, why we hold it, and who can see it - in plain language, with nothing hidden in a clause. If a line here doesn't match what the site actually does, that's a bug. Tell us."
      sections={sections}
    />
  );
}

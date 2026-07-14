import type { Metadata } from "next";
import { LegalDoc, type LegalSection } from "@/components/legal-doc";
import { site } from "@/lib/site";
import { legalUpdated } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms for using RO. Nation LIVE - reserving tickets, attending shows, applying for the crew, and using the partner sites we host.",
};

// These terms describe what the code actually enforces. Two clauses are
// load-bearing and must not be softened without changing the code first:
//
//   "Free tickets and paid tiers" - ROBUX_TICKETS_ENABLED is off, and
//   app/actions/tickets.ts refuses a priced tier independently of the UI. Nothing
//   is charged to anybody today. Wording that implied otherwise would be selling
//   a ticket the site cannot honour.
//
//   "Partner sites" - a partner running fan or tribute events carries a
//   disclaimer in their footer (see `disclaimer` in lib/partners/registry.ts).
//   These sites sit on our subdomains with our name in the footer, so an
//   ambiguous one is our problem as much as theirs.

const sections: LegalSection[] = [
  {
    heading: "Acceptance",
    body: [
      "By using this website, reserving a ticket, or attending one of our events, you agree to these terms. If you don't agree with them, don't reserve a ticket.",
      "They apply alongside our Privacy Policy and our Code of Conduct, which form part of them.",
      `They cover everything we run: ${site.name}'s own site, our staff and partner portals, our surveys, and the partner sites we host on our subdomains.`,
    ],
  },
  {
    heading: "Eligibility",
    body: [
      "You need a Roblox account to use this site, and you must be 13 or over to sign in, reserve a ticket, apply for a role or answer a survey.",
      "Use your own account, and give us accurate details. Don't impersonate anybody, and don't run several accounts to get around a ticket limit or a blacklist entry - that is a breach of these terms, and we treat it as one.",
    ],
  },
  {
    heading: "Your ticket",
    body: [
      "A ticket admits one person and is tied to the Roblox account that reserved it. It cannot be transferred, given away, or sold.",
      "Entry is verified inside the Roblox experience at the door, using your ticket code and your account. Sign in with the same account you reserved with, or you will not get in.",
      "Selling or trying to sell a ticket - for Robux, for money, for anything - voids it, and may get you kept out of future events.",
    ],
  },
  {
    heading: "Reservations, capacity and cancellation",
    body: [
      "Tickets are subject to availability and to a venue's capacity. Reserving one holds a place; activating it prepares it for entry.",
      "You can cancel your own ticket at any time from your tickets page. Please do cancel one you no longer need - the place goes straight back into the pool for somebody else.",
      "Repeatedly reserving tickets and not turning up may affect your priority for future events. There is nothing to be gained by hoarding places.",
    ],
  },
  {
    heading: "Free tickets and paid tiers",
    body: [
      "Every ticket you can reserve today is free. We take no payment on this website, and we hold no payment details.",
      "You may see a show listing a VIP or priority tier with a Robux price. It cannot currently be bought: paid ticketing is switched off, the tier renders locked, and the site refuses to issue one. A price next to a locked tier is a plan, not an offer - it creates no contract and no obligation on either of us.",
      "If we ever do switch paid tiers on, the purchase would happen inside the Roblox experience, through Roblox's own payment system - never on this site. Roblox would take the payment, and Roblox's terms and refund rules would apply to it. We will say so plainly, on the tier itself, before anybody can buy anything.",
    ],
  },
  {
    heading: "Changes to an event",
    body: [
      `${site.name} may cancel, reschedule, or change the venue, line-up or format of any event. We will announce changes through our channels wherever we can.`,
      "Because tickets are free, a cancelled or changed event does not entitle you to compensation. If a show you hold a ticket for is cancelled, the ticket is simply void.",
    ],
  },
  {
    heading: "Conduct",
    body: [
      "At our events, and on our sites, you agree to follow our Code of Conduct and the Roblox Community Standards.",
      "We may refuse entry to, remove, or ban anyone who breaks those rules - during a show, without notice, and at our discretion. Where somebody has harmed others, we keep a record so they can be kept out of future events; that record, and how to challenge it, is described in our Privacy Policy.",
      "Interfering with ticket verification - exploiting it, forging a code, or attacking the door system - is a serious breach, and ends in a permanent ban.",
    ],
  },
  {
    heading: "Things you send us",
    body: [
      "This covers a crew application, a survey answer, a message, or an image uploaded by a crew member.",
      "You keep ownership of what you send. You give us permission to store it and to use it for the purpose you sent it for - reviewing your application, counting your survey response, showing an image on the site it was uploaded to.",
      "You promise that what you send is yours to send: that you own it or have permission to use it, and that it isn't unlawful, hateful, misleading, or somebody else's copyrighted work.",
      "We may remove anything that breaks these terms, without notice. If you believe content on one of our sites infringes your rights, contact us with the details and we will look at it.",
    ],
  },
  {
    heading: "Uploads",
    body: [
      "Only our staff and a partner's crew can upload files. Uploads are images only and are size-limited, and the site checks what a file actually contains rather than trusting its name.",
      "If you upload, you are responsible for having the right to use that image. Don't upload anything you don't have permission to use, and don't upload anything built to attack the site or the people viewing it.",
    ],
  },
  {
    heading: "Partner sites",
    body: [
      "We host and operate sites for partner event groups on our subdomains. We provide the platform, the ticketing and the infrastructure; the partner's own crew writes the words, announces the shows, and reviews their own applications.",
      "Some partners run fan or tribute events themed around real-world artists. Those events are unofficial: they are not affiliated with, endorsed by, or connected to the artist, their management or their label; no official music, artwork or branding is used; and every such site carries a disclaimer saying so plainly.",
      "A partner is responsible for their own content. We are responsible for the platform, and we will act on content that breaks these terms - if something on a partner's site is wrong, report it to us and we will deal with it.",
    ],
  },
  {
    heading: "Crew roles and applications",
    body: [
      "Applying for a role is not an offer of work, and receiving your application doesn't oblige us to reply, to interview you, or to take anybody on.",
      "Roles are volunteer unless the listing says otherwise. Where one is described as paid, or as a paid trial, the terms of that are agreed with you separately and in writing before any work is done.",
      "An application to a partner's role goes to that partner's crew, not to us. Our Privacy Policy sets out who can see what.",
    ],
  },
  {
    heading: "Staff and portal access",
    body: [
      "Access to our staff portal, and to a partner's, comes from your rank in our Roblox group or from an explicit grant we make. It is a privilege we extend for as long as it is useful to us, and it can be withdrawn at any time, without notice - being demoted in the group removes it on its own.",
      "If you have access, use it only for what it was given for. Reading, copying or passing on our members' data for anything else breaks these terms, and most likely the law.",
    ],
  },
  {
    heading: "Using this website",
    body: ["Don't do any of the following:"],
    list: [
      "Scrape, crawl or bulk-download the site, or hammer our APIs.",
      "Automate ticket reservations, or try to take more than your share of a capacity.",
      "Try to reach an account, a portal, or data that isn't yours.",
      "Probe, scan or attack our infrastructure - including the ticket verification API.",
      "Upload or send anything malicious.",
    ],
  },
  {
    heading: "Availability, and no warranty",
    body: [
      "Our events happen inside Roblox, on a platform we don't control and can't fix. Roblox can go down, change, or lose a server in the middle of a set, and none of that is within our power.",
      "The site and our events are provided as they are. We don't promise uninterrupted availability of the website, of any Roblox experience, or of any event.",
    ],
  },
  {
    heading: "Liability",
    body: [
      "To the fullest extent the law allows, we are not liable for indirect or consequential loss arising from your use of this site or your attendance at an event - a show you couldn't get into, an event that was cancelled, a Roblox outage.",
      "Nothing in these terms limits any liability that cannot lawfully be limited.",
    ],
  },
  {
    heading: "Our name, and Roblox's",
    body: [
      `The ${site.name} name, logo and site design are ours. Don't use them to suggest we are involved in, or endorse, something we are not.`,
      "Roblox is a trademark of Roblox Corporation. We are an independent group - not affiliated with, endorsed by, or operated by Roblox Corporation.",
    ],
  },
  {
    heading: "Suspension and termination",
    body: [
      "We may suspend or end your access to this site, cancel your tickets, or refuse you entry to our events if you break these terms, our Code of Conduct, or the Roblox Community Standards.",
      "You can stop using the site whenever you like, and ask us to delete your account - see the Privacy Policy.",
    ],
  },
  {
    heading: "Changes to these terms",
    body: [
      "We may update these terms. When we do, we revise the date at the top of this page and announce anything significant through our channels. Using the site after a change means you accept the updated terms.",
    ],
  },
  {
    heading: "Contact",
    body: [
      `Questions about these terms? Use the contact page, or email ${site.contactEmail}.`,
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      updated={legalUpdated("/legal/terms")}
      currentHref="/legal/terms"
      intro="The rules for reserving tickets, coming to our shows, joining the crew, and using the partner sites we host. Written to be read - no dense legalese, and nothing important buried."
      sections={sections}
    />
  );
}

import type { Metadata } from "next";
import { LegalDoc, type LegalSection } from "@/components/legal-doc";
import { site } from "@/lib/site";
import { legalUpdated } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Ticket & Event Terms",
  description:
    "The rules that come with a RO. Nation LIVE ticket - free, tied to your Roblox account, not for resale, verified at the door, and void if a show is cancelled.",
};

// A focused restatement of the ticketing rules that also live in the general Terms of
// Service. It must not contradict them, and two clauses are load-bearing and mirror the
// code, exactly as they do on /legal/terms:
//
//   Free tickets - ROBUX_TICKETS_ENABLED is off and app/actions/tickets.ts refuses a
//   priced tier regardless of the UI. Nothing is charged on this site today.
//
//   Non-transferable - a ticket is tied to the reserving Roblox account and verified at
//   the door inside the Roblox experience against that account. Wording that implied a
//   ticket could be handed over would describe something the door does not permit.
//
// Keep this in step with /legal/terms; if the two ever disagree, that is the bug.

const sections: LegalSection[] = [
  {
    heading: "What these cover",
    body: [
      `These are the terms for reserving and using a ticket to a ${site.name} event. They expand on the ticket clauses in our Terms of Service, and sit alongside our Code of Conduct.`,
      "Our shows happen inside Roblox. A ticket is a place at one of them - not a physical thing, and not something that exists outside your account with us.",
    ],
  },
  {
    heading: "A ticket is free",
    body: [
      "Every ticket you can reserve today is free. We take no payment on this website and hold no payment details.",
      "You may see a show listing a VIP or priority tier with a Robux price. It cannot currently be bought - paid ticketing is switched off, the tier renders locked, and the site refuses to issue one. A price beside a locked tier is a plan, not an offer; it creates no contract on either side.",
      "If we ever switch paid tiers on, the purchase would happen inside the Roblox experience through Roblox's own payment system - never on this site - and Roblox's terms and refund rules would apply to it. We will say so plainly, on the tier itself, before anybody can buy anything.",
    ],
  },
  {
    heading: "It belongs to your account",
    body: [
      "A ticket admits one person and is tied to the Roblox account that reserved it. It cannot be transferred, given away, lent, or sold.",
      "Selling or trying to sell a ticket - for Robux, for money, for anything at all - voids it, and may get you kept out of future events.",
    ],
  },
  {
    heading: "Getting in",
    body: [
      "Entry is verified inside the Roblox experience at the door, using your ticket code and your account. Sign in with the same account you reserved with, or you will not get in.",
      "Interfering with that verification - forging a code, exploiting the door, or attacking the system behind it - is a serious breach and ends in a permanent ban.",
    ],
  },
  {
    heading: "Reservations and capacity",
    body: [
      "Tickets are subject to availability and to a venue's capacity. Reserving one holds a place; activating it prepares it for entry.",
      "Capacity is real and enforced at the door. Reserving a ticket does not guarantee entry if you arrive after a venue is full, or if the event's own limits are reached.",
    ],
  },
  {
    heading: "Cancelling, and not turning up",
    body: [
      "You can cancel your own ticket at any time from your tickets page. Please do cancel one you no longer need - the place goes straight back into the pool for somebody else.",
      "Repeatedly reserving tickets and not turning up may affect your priority for future events. There is nothing to be gained by hoarding places.",
    ],
  },
  {
    heading: "If a show changes or is cancelled",
    body: [
      `${site.name} may cancel, reschedule, or change the venue, line-up or format of any event. We announce changes through our channels wherever we can.`,
      "Because tickets are free, a cancelled or changed event does not entitle you to compensation. If a show you hold a ticket for is cancelled, the ticket is simply void.",
      "Our events run on Roblox, a platform we do not control. Roblox can go down, change, or lose a server in the middle of a set, and none of that is within our power - so we cannot promise uninterrupted availability of any event.",
    ],
  },
  {
    heading: "Conduct at a show",
    body: [
      "At our events you agree to follow our Code of Conduct and the Roblox Community Standards. We may refuse entry to, remove, or ban anyone who breaks them - during a show, without notice, and at our discretion.",
      "Where somebody has harmed others, we keep a record so they can be kept out of future events. How that record works, and how to challenge it, is set out in our Privacy Policy.",
    ],
  },
  {
    heading: "Your data",
    body: [
      "What we hold about your tickets - which event, a ticket code, the tier, and the times you accepted, activated and were checked in - is described in our Privacy Policy, along with how to get a copy of it or have it removed.",
    ],
  },
  {
    heading: "Contact",
    body: [
      `Questions about a ticket or a show? Use the contact page, or email ${site.contactEmail}.`,
    ],
  },
];

export default function TicketTermsPage() {
  return (
    <LegalDoc
      title="Ticket & Event Terms"
      updated={legalUpdated("/legal/tickets")}
      currentHref="/legal/tickets"
      intro="Everything a ticket is and isn't: free, tied to your account, not for resale, verified at the door - and void if the show is called off. The full deal is in our Terms of Service; this is the ticket part, on its own."
      sections={sections}
    />
  );
}

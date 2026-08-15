import type { Metadata } from "next";
import { LegalDoc, type LegalSection } from "@/components/legal-doc";
import { site } from "@/lib/site";
import { legalUpdated } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Code of Conduct",
  description:
    "The community rules everyone agrees to follow at RO. Nation LIVE events - what is expected, what happens when somebody breaks them, how to report something, and how to appeal.",
};

// The behaviour rules, and - the part that was missing - what actually happens when
// somebody breaks them.
//
// It used to be seven short paragraphs: the rules themselves, one line on reporting, one
// line on consequences. Everything a person needs when they are on the wrong end of this
// document was absent - where a report goes, what we do with it, what a ban means for the
// tickets they hold, and how to challenge one. A code that can remove somebody from an
// event and cancel their tickets has to say all four, or it is a rule with no process
// behind it.
//
// The enforcement wording is load-bearing and must stay true to the code:
//
//   "cancel the tickets you hold"   the blacklist decides entry, and a barred account's
//                                   tickets are voided (see the roster/blacklist guards).
//   "we keep a record"              RosterEntry + RosterAudit are append-only, with who
//                                   added the entry and why. The Privacy Policy describes
//                                   it, and the appeal route below is the one it promises.

const sections: LegalSection[] = [
  {
    heading: "The short version",
    body: [
      "Come to have a good time and let everyone else do the same. Be respectful, keep it safe, and follow staff instructions. That's most of it.",
      "The rest of this page is what we do when somebody doesn't - and how to challenge us if you think we've got it wrong.",
    ],
  },
  {
    heading: "Where this applies",
    body: [
      `This code applies wherever ${site.name} is: at our shows inside Roblox, on our websites and our partners', in our Discord, and in anything you send us - an application, a survey answer, a message.`,
      "It applies to everybody equally: attendees, performers, partners and our own crew. Being staff is not a defence, and a report about a member of our crew is taken exactly as seriously as any other.",
    ],
  },
  {
    heading: "Respect everyone",
    body: [
      "No harassment, hate speech, discrimination, threats, or bullying of any kind - toward attendees, performers, or crew. Treat people the way you'd want to be treated on the floor.",
      "That includes things aimed at somebody's race, religion, disability, gender, sexuality or age; sexual harassment of any kind; following somebody around a venue after they have asked you not to; and encouraging anybody else to do those things.",
      "**Nothing about a show is an invitation.** A crowded venue is not a reason to touch, follow, corner or spam somebody, and 'it was a joke' is not a defence anybody has ever successfully made to us.",
    ],
  },
  {
    heading: "Keep it safe and clean",
    body: [
      "No exploiting, cheating, or attempting to disrupt the experience, the event, or our verification systems. No sharing of inappropriate content. Keep chat and behaviour suitable for a mixed audience.",
      "Our shows have people of all ages in them. If you would not say it or show it to a room with thirteen-year-olds in it, do not bring it to one of ours.",
      "Do not use an event to scam, phish, advertise, or sell anything - including asking for Robux, offering trades, or promoting another group's show from inside ours.",
    ],
  },
  {
    heading: "Don't attack the door",
    body: [
      "Ticket verification is what keeps a venue to its capacity and keeps barred accounts out. Forging a code, reusing somebody else's, exploiting the door, or attacking the system behind it is one of the most serious things on this page.",
      "It is also the one where we do not do warnings. It ends in a permanent ban, and where it is serious we report it to Roblox.",
      "The same goes for buying, selling or trading a ticket. A ticket is tied to the account that reserved it - see our [Ticket & Event Terms](/legal/tickets).",
    ],
  },
  {
    heading: "Follow Roblox's rules",
    body: [
      "Our events run inside Roblox, so the Roblox Community Standards always apply. Anything that would get you moderated on Roblox will get you removed from our events too.",
      "Where the two disagree, Roblox's rules win on Roblox's platform. This code can be stricter than theirs; it is never a permission slip for something they forbid.",
    ],
  },
  {
    heading: "Listen to staff",
    body: [
      "Our moderators and hosts keep events running smoothly. Follow their instructions. They can mute, remove, or ban anyone who breaks these rules - at their discretion and without warning.",
      "A show is not the moment to argue the point. If you think a call was wrong, take it up with us afterwards, through the appeal route below - that is what it is there for, and using it is not held against you.",
    ],
  },
  {
    heading: "Reporting something",
    body: [
      "If you see something that breaks these rules, tell us. You do not need proof, you do not need to be certain, and you do not need to be the person it happened to.",
    ],
    list: [
      "**During a show** - tell a moderator or host in-experience. That is the fastest route, because somebody can act on it there and then.",
      `**Afterwards, or about something else** - report it in our [Discord](${site.socials.discord}) support channel, use the [contact page](/contact), or email [${site.contactEmail}](mailto:${site.contactEmail}).`,
      "**What helps** - the Roblox usernames involved, which show and roughly when, and what happened. A screenshot if you have one. Do not let a missing detail stop you reporting; we would rather have a partial report than none.",
    ],
  },
  {
    heading: "What we do with a report",
    body: [
      "A person reads it. We look at what happened, we may ask you or others for more detail, and we decide - the same way whoever it was about.",
      "We keep who reported something to as few people as it takes to act on it. We will not name you to the person you reported. If a report cannot be acted on without naming you, we will tell you that before we do anything, and it stays your choice.",
      "**Retaliating against somebody for reporting something is itself a breach of this code**, and we treat it as a serious one.",
      "If a report is about safety and cannot wait, act on it now and tell us after - remove yourself from the situation, leave the experience, and use Roblox's own reporting tools as well.",
    ],
  },
  {
    heading: "What happens if you break it",
    body: [
      "It depends on what happened. Roughly, in order:",
    ],
    list: [
      "A word from a moderator, and a chance to stop.",
      "Being muted or removed from the show you are at.",
      "Being barred from future events - an entry on our blacklist, with the reason recorded and who recorded it.",
      "Cancellation of the tickets you hold. A barred account does not get through the door, and we cancel rather than let somebody turn up to find out.",
      "For anything serious - harassment, threats, attacking the door, anything involving a minor - a permanent ban, imposed immediately and without any of the steps above, and a report to Roblox.",
    ],
  },
  {
    heading: "Appealing a decision",
    body: [
      "If you have been barred and you think it is wrong, ask us to look at it again. Tell us your Roblox username and anything you think we have missed.",
      "A different person reviews it where we can manage that. We look at the reason recorded on the entry and either remove it or explain it to you - and 'explain it' means an actual answer, not a form reply.",
      "We will not delete a blacklist entry simply because you ask, where removing it would put other people at risk. That is one of the honest limits on deletion set out in our [Privacy Policy](/legal/privacy) and on our [Data & Privacy Requests](/legal/data-requests) page - so ask us to **review** it rather than to erase it.",
      "A permanent ban for something serious is very unlikely to be reversed. We will still read your appeal, and we will still answer it.",
    ],
  },
  {
    heading: "Changes to this code",
    body: [
      "We update this page when we need to, and revise the date at the top of it. The version that applies to something is the one in force when it happened.",
    ],
  },
  {
    heading: "Contact",
    body: [
      `Reports, appeals, or anything about this code: use the [contact page](/contact), or email [${site.contactEmail}](mailto:${site.contactEmail}).`,
    ],
  },
];

export default function CodeOfConductPage() {
  return (
    <LegalDoc
      title="Code of Conduct"
      updated={legalUpdated("/legal/code-of-conduct")}
      currentHref="/legal/code-of-conduct"
      intro="Everyone who attends our events agrees to these rules. They exist to keep our shows safe, welcoming and fun for the whole crowd - so this page covers what's expected, how to report something, what we do about it, and how to appeal if you think we've got it wrong."
      sections={sections}
    />
  );
}

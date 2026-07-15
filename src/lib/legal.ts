// Every legal document RO. Nation LIVE publishes, in one place.
//
// A CODE REGISTRY, in the same spirit as lib/partners/registry.ts and
// lib/merch/collections.ts: pure data, no prisma, no env, validated at module load. The
// rule this codebase follows is "a row unless the edge has to resolve it first" - and this
// is the third case, the one where a DATABASE would simply be the wrong tool. These seven
// documents are code. They change in a pull request, they are reviewed like code, and a
// policy somebody could edit through an admin form without a diff is a policy nobody can
// prove the wording of on the day it matters.
//
// ---- Why the dates live here now ------------------------------------------
//
// Each page used to carry its own `updated="13 July 2026"` string as a prop, and nothing
// else knew it existed. So an index could not print "last updated" without a second copy
// of all seven dates, sitting in a different file, going stale the first time somebody
// edited a policy and forgot.
//
// Now the page reads its own entry from here. One date, one place, and the index gets it
// for free.

export type LegalDocEntry = {
  href: string;
  title: string;
  /** The heading it sits under on /legal. */
  group: "Site policies" | "Integrations";
  /** Human-written, and displayed as-is. Bump it when you change the wording. */
  updated: string;
  blurb: string;
};

export const LEGAL_DOCS: LegalDocEntry[] = [
  {
    href: "/legal/privacy",
    title: "Privacy Policy",
    group: "Site policies",
    updated: "15 July 2026",
    blurb:
      "What we hold about you, why we hold it, how long for, and how to get it deleted.",
  },
  {
    href: "/legal/terms",
    title: "Terms of Service",
    group: "Site policies",
    updated: "13 July 2026",
    blurb:
      "The deal: tickets are free, tied to your account, and not for resale. What we owe you and what we don't.",
  },
  {
    href: "/legal/code-of-conduct",
    title: "Code of Conduct",
    group: "Site policies",
    updated: "6 July 2026",
    blurb: "How to behave at a show, and what happens if you don't.",
  },
  {
    href: "/legal/accessibility",
    title: "Accessibility Notice",
    group: "Site policies",
    updated: "15 July 2026",
    blurb:
      "What we aim for, what we know is not there yet, and how to tell us something is in your way.",
  },
  {
    href: "/legal/cookies",
    title: "Cookie Notice",
    group: "Site policies",
    updated: "15 July 2026",
    blurb:
      "Every cookie this site sets, why it exists, and why there is no banner asking you to accept them.",
  },
  {
    href: "/legal/tickets",
    title: "Ticket & Event Terms",
    group: "Site policies",
    updated: "15 July 2026",
    blurb:
      "The rules for a ticket: free, tied to your account, not for resale, and void if the show is cancelled.",
  },
  {
    href: "/legal/data-requests",
    title: "Data & Privacy Requests",
    group: "Site policies",
    updated: "15 July 2026",
    blurb:
      "How to get a copy of your data, correct it, or have it deleted - what to send, and the two honest limits.",
  },
  {
    href: "/legal/refunds",
    title: "Merch & Refunds",
    group: "Site policies",
    updated: "15 July 2026",
    blurb:
      "The shop is a showcase - every purchase happens on Roblox, under Roblox's terms and refund rules.",
  },

  // The documents below concern how we connect to Roblox and Discord. The first four are the
  // URLs handed to Roblox and Discord when the OAuth sign-in apps were registered - a broken
  // link here is a broken sign-in for the whole platform, which is why they are listed rather
  // than buried. The last two cover our Discord bot, which is a separate thing again.
  {
    href: "/legal/roblox/privacy",
    title: "Roblox sign-in - Privacy",
    group: "Integrations",
    updated: "12 July 2026",
    blurb: "What the Roblox OAuth app asks for, and what we do with it.",
  },
  {
    href: "/legal/roblox/terms",
    title: "Roblox sign-in - Terms",
    group: "Integrations",
    updated: "12 July 2026",
    blurb: "The terms attached to signing in with a Roblox account.",
  },
  {
    href: "/legal/discord/privacy",
    title: "Discord sign-in - Privacy",
    group: "Integrations",
    updated: "12 July 2026",
    blurb: "What the Discord OAuth app asks for, and what we do with it.",
  },
  {
    href: "/legal/discord/terms",
    title: "Discord sign-in - Terms",
    group: "Integrations",
    updated: "12 July 2026",
    blurb: "The terms attached to signing in with a Discord account.",
  },

  // The Discord BOT is not the Discord sign-in. Sign-in is how staff get into the portal; the
  // bot is what lets an ordinary member tie their Roblox account to their Discord one, by
  // reading a short code from ronation.live/account/link. These two documents cover it.
  {
    href: "/legal/discord/bot/privacy",
    title: "Discord bot - Privacy",
    group: "Integrations",
    updated: "15 July 2026",
    blurb: "What the bot receives when you link your account, and what it stores.",
  },
  {
    href: "/legal/discord/bot/terms",
    title: "Discord bot - Terms",
    group: "Integrations",
    updated: "15 July 2026",
    blurb: "The terms for using our Discord bot and linking your account to it.",
  },
];

/** The date on one document. Throws at BUILD TIME if the page and the registry disagree. */
export function legalUpdated(href: string): string {
  const doc = LEGAL_DOCS.find((d) => d.href === href);
  // Loud, and at build time rather than in front of a visitor: a legal page whose href is
  // not in this list is a page missing from the index, which is a page nobody will find.
  if (!doc) {
    throw new Error(
      `legalUpdated("${href}"): no such document in lib/legal.ts. Add it there - the /legal index reads from that list, so a document missing from it is a document nobody can find.`,
    );
  }
  return doc.updated;
}

/** The documents, grouped, in declaration order. */
export function legalGroups(): { group: string; docs: LegalDocEntry[] }[] {
  const groups: { group: string; docs: LegalDocEntry[] }[] = [];
  for (const doc of LEGAL_DOCS) {
    const last = groups[groups.length - 1];
    if (last && last.group === doc.group) last.docs.push(doc);
    else groups.push({ group: doc.group, docs: [doc] });
  }
  return groups;
}

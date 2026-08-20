// What the RO. Nation LIVE partner programme actually is, as data.
//
// ONE module, read by four things that would otherwise each have their own copy of the
// pitch and drift apart within a month:
//
//   partner.ronation.live/           the programme page - the whole offer, in order
//   partner.ronation.live/join/new   the "what are you after?" checkboxes on the form
//   partner.ronation.live/onboard    the step that explains what a new partner just got
//   /company/partnerships            staff reading back which offers somebody ticked
//
// That last one is the reason the ids are stable strings rather than array positions.
// PartnerApplication.interests and PartnerOnboarding.interests store these ids, so
// renaming one silently orphans every row that held it - rename the LABEL freely, and
// treat the id as permanent.
//
// ---- Deliberately NOT server-only ------------------------------------------
//
// The join form is a client component (it counts characters and toggles fields), and it
// has to draw exactly the list the action validates against. Pure data, no prisma, no env -
// the same rule, and the same reason, as lib/partners/registry.ts.

export type ProgrammeOffer = {
  /** Stable. Stored in the database. See the note above. */
  id: string;
  title: string;
  /** One line, for a checkbox next to it. */
  summary: string;
  /** The paragraph on the programme page. */
  body: string;
  /**
   * What this actually costs or splits, said plainly. Optional, because two of these
   * cost nothing and pretending otherwise to make the list look uniform would be worse
   * than a shorter card.
   */
  terms?: string;
  /** The agreement on /legal that governs it, when one does. */
  agreementHref?: string;
};

/**
 * The offer, in the order it is worth reading.
 *
 * Everything here is something RNL can do TODAY, and the wording is checked against the
 * thing that implements it: the split is the one in the merchandise agreement, the site
 * features are the four in PartnerFeature, and paid ticketing carries the caveat that
 * lib/tickets/pricing.ts actually enforces. A programme page that promises a fifth
 * feature is a support ticket with a lead time.
 */
export const PROGRAMME_OFFERS: readonly ProgrammeOffer[] = [
  {
    id: "site",
    title: "Your own site",
    summary: "yourname.ronation.live, in your colours",
    body: "A full site on your own subdomain, built in your brand rather than ours - your palette, your type, your artwork behind every page. Shows, blog, careers and surveys are switched on per partner, so you get the ones you will use and nothing else. We build it; you brief it.",
  },
  {
    id: "tickets",
    title: "Ticketing",
    summary: "issue, scan and settle tickets under your own prefix",
    body: "Tickets for your shows, issued under your own code prefix, with the door scanner, the seating chart and the guest list behind them. Free and comped tickets work today. Paid tickets in Robux are switched on per partner and only once the in-experience purchase flow is live for you - we would rather say that here than sell you a ticket we cannot honour.",
    agreementHref: "/legal/partners/ticketing",
  },
  {
    id: "merch",
    title: "Merchandise",
    summary: "a shelf in our shop - you keep 90% of what reaches us",
    body: "Your merchandise on merch.ronation.live, in a collection that carries your whole identity rather than sitting in ours. We handle the storefront, the assets and the fulfilment through Roblox.",
    terms: "Roblox takes 30% of every sale. Of what is left, we keep 10% and you keep 90%.",
    agreementHref: "/legal/partners/merchandise",
  },
  {
    id: "production",
    title: "Production",
    summary: "our crew, stages and show-running on your night",
    body: "The part that is not software. Stage build, lighting, sound and a crew who have run the night before - either running your show for you, or working alongside people you bring.",
  },
  {
    id: "crew",
    title: "A portal for your crew",
    summary: "your team manage your own shows, without going through us",
    body: "Your people sign in with their Roblox accounts and manage your events, posts and roles themselves. Access is granted per account by us, or run off your own Roblox group ranks if you would rather hold that yourself.",
  },
  {
    id: "payments",
    title: "Payments and paperwork",
    summary: "one statement, every payout and invoice in it",
    body: "Everything financial between us in one place: payouts, invoices, receipts and credit notes, each on a link you can open, print or forward. You can ask to be paid, or tell us a payment is coming, without a Discord thread that nobody can find in March.",
  },
  {
    id: "assets",
    title: "Promotion",
    summary: "your show in front of our audience",
    body: "Your shows on our calendar, in our announcements and in front of the people who already come to ours. We use your artwork and your name to do it, under an agreement that says exactly which assets, what for, and how you withdraw one.",
    agreementHref: "/legal/partners/assets",
  },
] as const;

/** The ids alone - what a stored `interests` array is intersected against. */
export const PROGRAMME_OFFER_IDS: readonly string[] = PROGRAMME_OFFERS.map(
  (o) => o.id,
);

/**
 * Keep only the ids this programme actually offers, in declaration order.
 *
 * Every write path for an `interests` column goes through here. Order is normalised as
 * well as membership, so two rows holding the same three offers read the same in the
 * inbox - and so a form that renders them in a different order cannot make it look like
 * somebody answered differently.
 */
export function cleanOfferIds(input: unknown): string[] {
  const wanted = new Set(
    (Array.isArray(input) ? input : [input])
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim()),
  );
  return PROGRAMME_OFFER_IDS.filter((id) => wanted.has(id));
}

/** The offer with this id, or null. For rendering a stored selection back. */
export function offerById(id: string): ProgrammeOffer | null {
  return PROGRAMME_OFFERS.find((o) => o.id === id) ?? null;
}

/**
 * "Your own site, Ticketing and Merchandise" - a stored selection, in prose.
 *
 * Unknown ids are dropped rather than printed. A row written before an offer was retired
 * should read as the offers that still exist, not as a string nobody can look up.
 */
export function describeOffers(ids: readonly string[]): string {
  const titles = cleanOfferIds(ids).map((id) => offerById(id)!.title);
  if (!titles.length) return "Nothing in particular";
  if (titles.length === 1) return titles[0];
  return `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;
}

/**
 * What actually happens after somebody asks, start to finish.
 *
 * Written as a promise RNL can keep. There is no "within 48 hours" in here, because the
 * people reading it can count - and a stated turnaround that slips once is worse than no
 * number at all.
 */
export const PROGRAMME_JOURNEY = [
  {
    title: "You get in touch",
    body: "Either you ask us, on this site, or we ask you - we hand out invite links to groups and creators we want to work with.",
  },
  {
    title: "We talk it through",
    body: "A real conversation about what you run, what you want from it, and which parts of the programme are worth switching on. Nothing is signed at this stage.",
  },
  {
    title: "You read the agreements",
    body: "Three of them - merchandise, ticketing and assets. They set the split and what each side may do. They are written to be read, and anything you want changed is changed before either side commits to it.",
  },
  {
    title: "We set you up",
    body: "Your account opens, your crew get their access, and we brief and build your site. Payments and paperwork start flowing through your statement from day one.",
  },
] as const;

/**
 * The honest version of who this is for.
 *
 * On the programme page under the offer, because the single most expensive thing here is
 * a long conversation with somebody who was never going to be a fit - and they would
 * rather have known on the first page.
 */
export const PROGRAMME_FIT = {
  yes: [
    "Roblox groups running gigs, festivals, club nights or live shows",
    "Creators and DJs with an audience who want the production behind them",
    "Labels, artists and brands who want a presence at Roblox events",
    "Venue and stage builders who want their work in front of promoters",
  ],
  no: [
    "Anyone wanting a site built with no events behind it - we are an events company, not a web shop",
    "Groups whose events break Roblox's own rules. We check.",
    "Tribute or fan projects that will not carry a disclaimer saying the real act is not involved",
  ],
} as const;

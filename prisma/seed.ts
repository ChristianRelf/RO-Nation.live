import {
  PrismaClient,
  EventStatus,
  JobStatus,
  PartnerRole,
} from "@prisma/client";

const prisma = new PrismaClient();

// Dates are generated relative to "now" so the demo never looks stale.
const now = new Date();
const day = 24 * 60 * 60 * 1000;
const at = (offsetDays: number, hour = 19) => {
  const d = new Date(now.getTime() + offsetDays * day);
  d.setHours(hour, 0, 0, 0);
  return d;
};

// ------------------------------------------------------------------
// Sleep Token — RNL's first partner.
//
// The partner itself is not seeded: it lives in code, in
// src/lib/partners/registry.ts. What the database holds is the two things that
// vary per request — who may use their portal, and what shows they're putting
// on.
// ------------------------------------------------------------------
const STRO = "sleeptokenro";

const stroEvents = [
  {
    slug: "stro-the-first-rite",
    title: "THE FIRST RITE",
    tagline: "The opening night — one stage, one set, no encore",
    category: "Tribute Show",
    venue: "The Hollow — Main Stage",
    description:
      "The first one. A full tribute set staged inside Roblox, built from the ground up by the Sleep Token crew — lighting, staging, the lot. Doors open an hour early: come in, walk the grounds, find your spot on the floor before it fills.\n\nFree entry. One ticket per account, verified at the door.",
    capacity: 300,
    featured: true,
    status: EventStatus.PUBLISHED,
    startsAt: at(21),
    doorsAt: at(21, 18),
    partnerId: STRO,
  },
  {
    slug: "stro-vessels-night",
    title: "VESSELS NIGHT",
    tagline: "An acoustic, low-light second show",
    category: "Tribute Show",
    venue: "The Hollow — Side Room",
    description:
      "Stripped back and close. A smaller room, a quieter set, and a hard cap on the floor so it stays that way.\n\nFree entry. One ticket per account, verified at the door.",
    capacity: 120,
    status: EventStatus.PUBLISHED,
    startsAt: at(45),
    doorsAt: at(45, 19),
    partnerId: STRO,
  },
];

/**
 * The partner's portal crew.
 *
 * A slug in the registry grants nobody anything — a PartnerMember row IS the
 * grant (see lib/partners/guard.ts), so without at least one OWNER here, nobody
 * can sign in to portal.ronation.live/sleeptokenro at all.
 *
 * The Roblox id has to be real, and only you know it, so it comes from the
 * environment rather than being invented here:
 *
 *   STRO_OWNER_ROBLOX_ID=123456789 STRO_OWNER_NAME=SomeUser npm run seed
 *
 * Find it at https://www.roblox.com/users/<id>/profile — the number in the URL.
 */
/**
 * Ticket tiers for the opening night.
 *
 * This is the shape the whole paid-ticket option exists for: a free general
 * admission that anybody can take, sitting next to a Robux-priced VIP tier that
 * NOBODY can take — because ROBUX_TICKETS_ENABLED is off. Reserve a ticket for
 * this show and you will see the VIP tier rendered, priced, and locked, with the
 * reserve action refusing it independently of the UI.
 *
 * The other show is left with no tiers at all, on purpose: that is the implicit
 * free admission, and it is what every event looked like before tiers existed.
 * Both paths are seeded so both stay exercised.
 */
const stroTiers: Record<
  string,
  Array<{
    name: string;
    description: string;
    perks: string[];
    priceRobux: number;
    capacity: number;
  }>
> = {
  "stro-the-first-rite": [
    {
      name: "General Admission",
      description: "Standing, main floor. Free, as every RNL show has been.",
      perks: ["Entry when doors open", "Main floor and balcony"],
      priceRobux: 0,
      capacity: 0, // uncapped — the room's own 300 still applies
    },
    {
      name: "VIP — Front Barrier",
      description: "The barrier, an hour early, and a room to wait in.",
      perks: [
        "Early entry, one hour before doors",
        "Reserved spot on the front barrier",
        "Access to the VIP room between sets",
      ],
      priceRobux: 250,
      capacity: 40,
    },
  ],
};

/**
 * Sleep Token's homepage copy.
 *
 * This used to be hardcoded in app/p/[slug]/page.tsx. It is now a row they own
 * and can edit in their studio — so it is SEEDED, not baked in, and seeded only
 * when the row is absent. Re-running the seed must never overwrite a change they
 * made themselves, which is why this is a create-if-missing rather than an upsert.
 *
 * Two of the FAQ answers are load-bearing rather than decorative. The VIP one
 * must not imply anything is on sale — paid tiers render locked while
 * ROBUX_TICKETS_ENABLED is off, and a page that promises otherwise sells a ticket
 * the site cannot honour. The last one restates the disclaimer in a visitor's own
 * words; the footer carries the formal version, and neither replaces the other.
 */
const stroContent = {
  heroKicker: "Roblox tribute shows",
  heroSubtitle:
    "Tribute shows staged inside Roblox. Full production, a live crowd, and a free ticket tied to your account.",
  aboutKicker: "About",
  aboutTitle: "A fan project, staged properly.",
  aboutBody:
    "Sleep Token is a Roblox event series run by fans — tribute shows, built and performed inside the platform, produced with the crew at RO. Nation LIVE. Tickets are free and tied to your Roblox account, so the floor stays fair and the door moves fast.",
  aboutNote:
    "We're not the band, and we don't pretend to be. No official music, artwork or branding is used here — this is a community putting on a show for people who love the same records we do.",
  faq: [
    {
      q: "What does a ticket cost?",
      a: "Nothing. Every ticket you can reserve today is free — one per Roblox account, tied to that account, and checked at the door.",
    },
    {
      q: "How do I get in on the night?",
      a: "Reserve a ticket, then open it from My tickets when doors open. It carries a code beginning ST-, and the crew redeems it as you come through — no code, no entry, so reserve before you travel.",
    },
    {
      q: "Some shows list a VIP tier. Can I buy one?",
      a: "Not yet. VIP tiers are designed and priced, but paid ticketing is switched off across the platform, so they render locked and cannot be reserved. Nothing is charged to anybody today.",
    },
    {
      q: "The show is sold out. Will more tickets appear?",
      a: "The cap is the room, so a sold-out show usually stays sold out. Tickets do come back when people release them, and the next show is normally announced within a few weeks.",
    },
    {
      q: "Are you the band?",
      a: "No — and we don't pretend to be. This is a fan-run Roblox event series, produced with RO. Nation LIVE. It isn't affiliated with, endorsed by, or connected to Sleep Token, and no official music, artwork or branding is used.",
    },
  ],
};

async function seedPartner() {
  // Create-if-missing: a partner who has edited their homepage must not have it
  // reset from under them the next time the container boots.
  const content = await prisma.partnerContent.findUnique({
    where: { partnerId: STRO },
  });
  if (!content) {
    await prisma.partnerContent.create({
      data: { partnerId: STRO, ...stroContent },
    });
  }

  for (const e of stroEvents) {
    const event = await prisma.event.upsert({
      where: { slug: e.slug },
      update: {},
      create: e,
    });

    const tiers = stroTiers[e.slug];
    if (!tiers) continue;

    // Only on a show that has none, so re-running the seed never duplicates a
    // tier or resets one somebody has edited in the portal.
    const already = await prisma.ticketTier.count({
      where: { eventId: event.id },
    });
    if (already > 0) continue;

    await prisma.ticketTier.createMany({
      data: tiers.map((t, i) => ({ ...t, eventId: event.id, sortOrder: i })),
    });
  }

  const ownerId = process.env.STRO_OWNER_ROBLOX_ID?.trim();
  const ownerName = process.env.STRO_OWNER_NAME?.trim() || "Sleep Token";

  if (!ownerId) {
    console.warn(
      `[seed] ${stroEvents.length} Sleep Token shows created, but NO portal owner.\n` +
        `[seed] Nobody can sign in to portal.ronation.live/${STRO} until one exists.\n` +
        `[seed] Re-run with: STRO_OWNER_ROBLOX_ID=<roblox-user-id> STRO_OWNER_NAME=<username> npm run seed`,
    );
    return;
  }

  await prisma.partnerMember.upsert({
    where: { partnerId_robloxId: { partnerId: STRO, robloxId: ownerId } },
    update: { role: PartnerRole.OWNER },
    create: {
      partnerId: STRO,
      robloxId: ownerId,
      robloxUsername: ownerName,
      displayName: ownerName,
      role: PartnerRole.OWNER,
      addedById: "seed",
      addedByName: "RO. Nation LIVE",
    },
  });

  console.log(
    `[seed] Sleep Token: ${stroEvents.length} shows, owner ${ownerName} (${ownerId}).`,
  );
}

const events = [
  {
    slug: "midnight-frequency",
    title: "MIDNIGHT FREQUENCY",
    tagline: "A four-stage after-dark concert takeover",
    category: "Live Show",
    venue: "The Vault — Main Stage",
    description:
      "The flagship returns. Four stages, a full live production crew, and a headline set built entirely inside our custom venue. Doors open early so you can explore the grounds, grab merch, and claim a spot on the floor before the frequency drops. Bring your crew — this one runs till the servers give out.",
    thumbnailUrl: "/placeholders/event-01.svg",
    capacity: 500,
    featured: true,
    startsAt: at(9, 20),
    doorsAt: at(9, 19),
    endsAt: at(9, 23),
    status: EventStatus.PUBLISHED,
  },
  {
    slug: "summer-live-showcase",
    title: "SUMMER LIVE SHOWCASE",
    tagline: "Rising creators take the main stage",
    category: "Showcase",
    venue: "Skyline Amphitheatre",
    description:
      "An open showcase spotlighting the next wave of performers, builders, and DJs in the community. Six acts, one night, judged live by the RO. Nation production team. Reserve early — floor capacity is strictly limited and check-in is verified at the door in-experience.",
    thumbnailUrl: "/placeholders/event-02.svg",
    capacity: 300,
    featured: false,
    startsAt: at(21, 18),
    doorsAt: at(21, 17),
    endsAt: at(21, 21),
    status: EventStatus.PUBLISHED,
  },
  {
    slug: "grid-clash-tournament",
    title: "GRID CLASH",
    tagline: "16 teams. One trophy. Live-casted.",
    category: "Tournament",
    venue: "Arena 7",
    description:
      "Our competitive night: sixteen teams, a live commentary desk, and a bracket played out on the big screens. Tickets get you a guaranteed spectator slot in the arena bowl plus entry to the post-match after-party stage.",
    thumbnailUrl: "/placeholders/event-03.svg",
    capacity: 400,
    featured: false,
    startsAt: at(34, 19),
    doorsAt: at(34, 18),
    endsAt: at(34, 22),
    status: EventStatus.PUBLISHED,
  },
  {
    slug: "neon-block-party",
    title: "NEON BLOCK PARTY",
    tagline: "Free-roam street festival",
    category: "Festival",
    venue: "District 9 Streets",
    description:
      "A relaxed, all-ages street festival — food stalls, mini-games, a roller stage, and a sunset DJ set. No assigned seating, just show your ticket at the gate and wander. Perfect first RO. Nation LIVE event if you've never been.",
    thumbnailUrl: "/placeholders/event-04.svg",
    capacity: 0,
    featured: false,
    startsAt: at(48, 17),
    doorsAt: at(48, 16),
    endsAt: at(48, 21),
    status: EventStatus.PUBLISHED,
  },
  {
    slug: "afterhours-vol-3",
    title: "AFTERHOURS VOL. 3",
    tagline: "Sold out — that's a wrap",
    category: "Live Show",
    venue: "The Vault — Main Stage",
    description:
      "The third instalment of our late-night series. Thanks to everyone who packed the floor — recap reel and photo dump are live on our socials.",
    thumbnailUrl: "/placeholders/event-05.svg",
    capacity: 500,
    featured: false,
    startsAt: at(-16, 20),
    doorsAt: at(-16, 19),
    endsAt: at(-16, 23),
    status: EventStatus.PUBLISHED,
  },
];

const careers = [
  {
    slug: "event-host",
    title: "Event Host",
    department: "Live Operations",
    commitment: "Volunteer",
    location: "Remote — Roblox",
    summary:
      "Be the voice of the show. Hosts run the crowd, cue segments, and keep the energy up from doors to close.",
    description:
      "As an Event Host you're on-mic and on-camera for the community. You'll open shows, hype transitions between acts, run crowd games, and keep hundreds of attendees moving through the night. We're after confident communicators who can think on their feet and stay calm when a server hits capacity.",
    requirements:
      "Comfortable speaking live on voice/stream\nAvailable for at least 2 events per month\n14+ and active in the community for 30+ days\nReliable mic and stable connection\nCan take direction from the production desk in real time",
    status: JobStatus.OPEN,
  },
  {
    slug: "stage-builder",
    title: "Stage & Set Builder",
    department: "Production",
    commitment: "Trial → Paid",
    location: "Remote — Roblox Studio",
    summary:
      "Design the venues people remember. Build stages, lighting rigs, and interactive set pieces in Studio.",
    description:
      "Our builders turn a brief into a venue that thousands walk through. You'll own set pieces from blockout to final dressing, optimise for large servers, and work with the scripting team on interactive lighting and effects. Strong portfolios move to a paid trial event immediately.",
    requirements:
      "Confident in Roblox Studio (parts, unions, or mesh workflows)\nEye for lighting, scale, and atmosphere\nUnderstands performance for 100+ player servers\nPortfolio or past builds to share\nBonus: experience with attribute-driven or scripted props",
    status: JobStatus.OPEN,
  },
  {
    slug: "social-media-manager",
    title: "Social Media Manager",
    department: "Marketing",
    commitment: "Volunteer",
    location: "Remote",
    summary:
      "Own our voice across platforms — teasers, recaps, and the countdown to every drop.",
    description:
      "You'll plan and publish the content that fills our events. Expect to cut short recap clips, write launch copy, run the event countdown, and reply to the community. We give you the assets and the calendar; you make it land.",
    requirements:
      "Sharp, on-brand writing\nCan edit short-form clips (any tool)\nActive daily and quick to reply\nUnderstands the Roblox events scene\nOrganised — you hit posting windows",
    status: JobStatus.OPEN,
  },
  {
    slug: "moderation-team",
    title: "Event Moderator",
    department: "Trust & Safety",
    commitment: "Volunteer",
    location: "Remote — Roblox",
    summary:
      "Keep events safe and fun. Moderators watch the floor and handle issues fast and fairly.",
    description:
      "Moderators are the reason our events stay welcoming. You'll be in-server during shows watching chat and behaviour, actioning our rules consistently, and escalating anything serious to leads. Calm, fair, and unbothered by pressure is the whole job.",
    requirements:
      "16+ with prior moderation experience preferred\nKnows our community rules cold\nCalm and consistent under pressure\nAvailable during peak event hours\nDiscord for team coordination",
    status: JobStatus.OPEN,
  },
];

async function main() {
  // The partner seed runs unconditionally. It is all upserts, so it is safe to
  // re-run — and it must NOT sit behind the "already seeded" guard below, or it
  // would never run at all on the live database, which already has events.
  await seedPartner();

  const existing = await prisma.event.count({ where: { partnerId: null } });
  if (existing > 0) {
    console.log(`[seed] ${existing} RNL events already present — skipping demo seed.`);
    return;
  }

  for (const e of events) {
    await prisma.event.upsert({
      where: { slug: e.slug },
      update: {},
      create: e,
    });
  }
  for (const c of careers) {
    // Careers are unique per [partnerId, slug] now, not by slug alone. It cannot
    // be an upsert: Prisma's compound-unique lookup will not take a null, and
    // RNL's half of this key IS null. Find-then-create is the same thing here —
    // this only ever runs on an empty database (see the guard in main()).
    const existing = await prisma.career.findFirst({
      where: { partnerId: null, slug: c.slug },
    });
    if (!existing) await prisma.career.create({ data: c });
  }
  console.log(
    `[seed] created ${events.length} events and ${careers.length} careers.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

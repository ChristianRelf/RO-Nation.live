import { PrismaClient, EventStatus, JobStatus } from "@prisma/client";

const prisma = new PrismaClient();

// Dates are generated relative to "now" so the demo never looks stale.
const now = new Date();
const day = 24 * 60 * 60 * 1000;
const at = (offsetDays: number, hour = 19) => {
  const d = new Date(now.getTime() + offsetDays * day);
  d.setHours(hour, 0, 0, 0);
  return d;
};

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
  const existing = await prisma.event.count();
  if (existing > 0) {
    console.log(`[seed] ${existing} events already present — skipping seed.`);
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
    await prisma.career.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
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

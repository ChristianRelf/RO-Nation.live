// Starter rooms.
//
// A blank canvas is a bad place to start drawing a 900-seat bowl - every arena has the
// same shape, and typing it out shape by shape is an hour nobody has. So this file holds
// a handful of ROOMS ALREADY DRAWN: a couple of arenas, a couple of amphitheatres. Pick
// one when you make a venue and the designer opens with the seating in place.
//
// ---- What is deliberately NOT here: the stage ------------------------------
//
// None of these carry a STAGE shape, and that is the whole point of the ordering. A stage
// is the one thing that is different every time - end stage, in the round, thrust, a
// festival's four-metre riser - so the room comes with the SEATING laid out and the front
// left clear, and you draw the stage in where it actually goes. The seats are the tedious
// part; the stage is the part that needs a human looking at it.
//
// ---- Pure, like everything else in this folder -----------------------------
//
// No prisma, no DOM, no "server-only". A build() returns a plain VenueLayout - the exact
// shape schema.ts validates and seats.ts expands - so the same object feeds the server
// action that saves it AND the <VenueMap> preview the new-venue page draws. Four readers,
// one shape, same rule as the rest of the folder.
//
// ---- On the numbers --------------------------------------------------------
//
// Coordinates are viewBox units (see schema.ts): Y grows DOWN, the stage end is the TOP,
// and best-available walks the shapes in array order - so sections are declared best-first
// (centre and front before the wings and the back). `rotation` fans a side stand to face
// the stage; `curve` bows each row's ends away from it so a block faces in rather than
// staring past; `rake` narrows a tier as it climbs. All three are honoured identically by
// the SVG outline and the seat grid (venue-map.tsx spins both about the same centre), so a
// turned grandstand's chairs stay inside its outline.
//
// These are STARTERS. Every number here is meant to be dragged, renamed and re-tiered in
// the designer - they only have to be a better place to start than an empty room.

import {
  venueLayoutSchema,
  type Shape,
  type VenueLayout,
} from "./schema";

// ---- Tiny builders ---------------------------------------------------------
//
// Just enough to keep a layout readable as a list of rooms rather than a wall of object
// literals. Each returns a fully-formed Shape; `z` is passed in as the declaration index so
// paint order follows the order things are written.

type Rect = { x: number; y: number; w: number; h: number; rotation?: number };

function rect(r: Rect) {
  return { type: "rect" as const, ...r, rotation: r.rotation ?? 0 };
}

function seated(
  z: number,
  key: string,
  name: string,
  geom: Rect,
  rows: {
    rows: number;
    seatsPerRow: number;
    curve?: number;
    rake?: number;
    rowLabelStart?: string;
    seatStart?: number;
  },
): Shape {
  return {
    key,
    name,
    z,
    geom: rect(geom),
    kind: "SEATED_SECTION",
    // A template belongs to no event, so it can carry no tier - the ids are assigned on
    // each event's own copy, and cloneTemplateOnto() clears them anyway. Always null here.
    tierId: null,
    rows: {
      rows: rows.rows,
      seatsPerRow: rows.seatsPerRow,
      rowLabelStart: rows.rowLabelStart ?? "A",
      seatStart: rows.seatStart ?? 1,
      skips: [],
      curve: rows.curve ?? 0,
      rake: rows.rake ?? 0,
    },
  };
}

function standing(
  z: number,
  key: string,
  name: string,
  geom: Rect,
  capacity: number,
): Shape {
  return {
    key,
    name,
    z,
    geom: rect(geom),
    kind: "STANDING_AREA",
    tierId: null,
    capacity,
  };
}

function layout(
  viewBox: { w: number; h: number },
  shapes: Shape[],
): VenueLayout {
  // No anchor - that is world placement for the 3D booth, and it is set later against the
  // real experience, not baked into a shared starter. A map with no anchor works everywhere
  // the game is not involved (picker, stub, door), which is exactly this stage of its life.
  //
  // No backdrop either: a preset IS the drawing, so there is nothing to trace.
  return { viewBox, grid: 10, anchor: null, backdrop: null, shapes };
}

// ---- The rooms -------------------------------------------------------------

/** ARENA · end stage. A bowl facing one open end, where the stage goes. ~776 seats. */
function arenaEndStage(): VenueLayout {
  return layout({ w: 1000, h: 700 }, [
    // Lower bowl - closest to the stage, offered first.
    seated(0, "LWRC", "Lower Centre", { x: 360, y: 190, w: 280, h: 120 }, { rows: 6, seatsPerRow: 22, curve: 14, rake: 3 }),
    seated(1, "LWRL", "Lower Left", { x: 150, y: 200, w: 180, h: 140, rotation: 16 }, { rows: 7, seatsPerRow: 12, curve: 8, rake: 2 }),
    seated(2, "LWRR", "Lower Right", { x: 670, y: 200, w: 180, h: 140, rotation: -16 }, { rows: 7, seatsPerRow: 12, curve: 8, rake: 2 }),
    // Upper bowl - behind and above, bigger and steeper.
    seated(3, "UPRC", "Upper Centre", { x: 320, y: 400, w: 360, h: 160 }, { rows: 8, seatsPerRow: 28, curve: 24, rake: 4 }),
    seated(4, "UPRL", "Upper Left", { x: 90, y: 380, w: 190, h: 190, rotation: 22 }, { rows: 9, seatsPerRow: 14, curve: 10, rake: 2 }),
    seated(5, "UPRR", "Upper Right", { x: 720, y: 380, w: 190, h: 190, rotation: -22 }, { rows: 9, seatsPerRow: 14, curve: 10, rake: 2 }),
  ]);
}

/** ARENA · horseshoe. Seating wraps round three sides; the open top is the stage. ~864 seats. */
function arenaHorseshoe(): VenueLayout {
  return layout({ w: 1000, h: 760 }, [
    // Lower horseshoe.
    seated(0, "LC", "Lower Centre", { x: 390, y: 210, w: 220, h: 120 }, { rows: 6, seatsPerRow: 18, curve: 12, rake: 3 }),
    seated(1, "LL", "Lower Left", { x: 230, y: 210, w: 150, h: 150, rotation: 30 }, { rows: 7, seatsPerRow: 11, curve: 8, rake: 2 }),
    seated(2, "LR", "Lower Right", { x: 620, y: 210, w: 150, h: 150, rotation: -30 }, { rows: 7, seatsPerRow: 11, curve: 8, rake: 2 }),
    seated(3, "LLW", "Lower Left Wing", { x: 120, y: 290, w: 140, h: 180, rotation: 58 }, { rows: 8, seatsPerRow: 10, curve: 6, rake: 2 }),
    seated(4, "LRW", "Lower Right Wing", { x: 740, y: 290, w: 140, h: 180, rotation: -58 }, { rows: 8, seatsPerRow: 10, curve: 6, rake: 2 }),
    // Upper horseshoe.
    seated(5, "UC", "Upper Centre", { x: 340, y: 470, w: 320, h: 150 }, { rows: 8, seatsPerRow: 26, curve: 22, rake: 4 }),
    seated(6, "UL", "Upper Left", { x: 120, y: 440, w: 180, h: 200, rotation: 28 }, { rows: 9, seatsPerRow: 13, curve: 10, rake: 2 }),
    seated(7, "UR", "Upper Right", { x: 700, y: 440, w: 180, h: 200, rotation: -28 }, { rows: 9, seatsPerRow: 13, curve: 10, rake: 2 }),
  ]);
}

/** AMPHITHEATRE · fan. Wide sweeping tiers plus angled wings, all facing a front stage. ~1,254 seats. */
function amphitheatreFan(): VenueLayout {
  return layout({ w: 1000, h: 720 }, [
    seated(0, "FRT", "Front Tier", { x: 250, y: 180, w: 500, h: 110 }, { rows: 5, seatsPerRow: 40, curve: 30, rake: 4 }),
    seated(1, "MID", "Middle Tier", { x: 190, y: 320, w: 620, h: 140 }, { rows: 7, seatsPerRow: 50, curve: 45, rake: 5 }),
    seated(2, "REAR", "Rear Tier", { x: 140, y: 490, w: 720, h: 170 }, { rows: 8, seatsPerRow: 58, curve: 60, rake: 6 }),
    seated(3, "WL", "Left Wing", { x: 80, y: 250, w: 150, h: 280, rotation: 18 }, { rows: 10, seatsPerRow: 12, curve: 10, rake: 2 }),
    seated(4, "WR", "Right Wing", { x: 770, y: 250, w: 150, h: 280, rotation: -18 }, { rows: 10, seatsPerRow: 12, curve: 10, rake: 2 }),
  ]);
}

/** AMPHITHEATRE · reserved + lawn. Reserved seats down front, terraces at the sides, GA lawn behind. ~674 seats + 1,500 standing. */
function amphitheatreLawn(): VenueLayout {
  return layout({ w: 1000, h: 720 }, [
    seated(0, "PIT", "Pit", { x: 300, y: 170, w: 400, h: 90 }, { rows: 4, seatsPerRow: 34, curve: 25, rake: 3 }),
    seated(1, "RSVD", "Reserved", { x: 230, y: 280, w: 540, h: 140 }, { rows: 7, seatsPerRow: 46, curve: 50, rake: 5 }),
    seated(2, "TERRL", "Left Terrace", { x: 110, y: 250, w: 150, h: 230, rotation: 16 }, { rows: 9, seatsPerRow: 12, curve: 8, rake: 2 }),
    seated(3, "TERRR", "Right Terrace", { x: 740, y: 250, w: 150, h: 230, rotation: -16 }, { rows: 9, seatsPerRow: 12, curve: 8, rake: 2 }),
    // The lawn is sold by the head, not the chair - a STANDING_AREA. Its capacity is a
    // starting guess; the tier's cap and the event's own still apply on top of it.
    standing(4, "LAWN", "Lawn (GA)", { x: 180, y: 470, w: 640, h: 180 }, 1500),
  ]);
}

// ---- The registry ----------------------------------------------------------

export type VenuePreset = {
  /** Stable id posted by the new-venue form and resolved by presetLayout(). */
  id: string;
  /** The family, for grouping the picker. */
  group: "Arena" | "Amphitheatre";
  name: string;
  blurb: string;
  build: () => VenueLayout;
};

export const VENUE_PRESETS: VenuePreset[] = [
  {
    id: "arena-end-stage",
    group: "Arena",
    name: "End stage",
    blurb: "A bowl facing one open end. Lower and upper tiers, left and right. Draw the stage across the open top.",
    build: arenaEndStage,
  },
  {
    id: "arena-horseshoe",
    group: "Arena",
    name: "Horseshoe",
    blurb: "Seating wrapped round three sides with the stage in the open mouth. More of the room sees the show side-on.",
    build: arenaHorseshoe,
  },
  {
    id: "amphitheatre-fan",
    group: "Amphitheatre",
    name: "Fan",
    blurb: "Wide, gently curved tiers rising away from the stage, with angled wings. The classic open-air sweep.",
    build: amphitheatreFan,
  },
  {
    id: "amphitheatre-lawn",
    group: "Amphitheatre",
    name: "Reserved + lawn",
    blurb: "Reserved seats down front and terraces at the sides, with a large general-admission lawn behind.",
    build: amphitheatreLawn,
  },
];

/**
 * Resolve a preset id to a layout, for the server action that creates a venue.
 *
 * The action passes an ID, never geometry: the rooms are authored in this file and nothing
 * a browser sends decides their shape. An unknown id returns null and the caller falls back
 * to an empty room - a forged `preset` field can do no more than start you on a blank canvas.
 *
 * The build is re-validated through the real schema on the way out, so a preset that ever
 * drifted out of spec fails safe (null → empty) rather than writing a layout the picker and
 * allocator would then choke on.
 */
export function presetLayout(id: string): VenueLayout | null {
  const preset = VENUE_PRESETS.find((p) => p.id === id);
  if (!preset) return null;

  const parsed = venueLayoutSchema.safeParse(preset.build());
  return parsed.success ? parsed.data : null;
}

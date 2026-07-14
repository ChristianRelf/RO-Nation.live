// What a drawn venue IS.
//
// Deliberately PURE - no prisma, no env, no "server-only". The designer (client)
// writes this, the seat picker (client) renders it, the allocator (server) sells
// against it, and the game API (server) hands it to Roblox. Four readers, and the
// only way four readers cannot disagree about what a venue is is if they all read
// the same file. Same discipline as lib/tickets/pricing.ts, and the same warning:
//
// NOTHING HERE IS A SECURITY BOUNDARY. This is the SHAPE of a layout. Whether a
// seat is free, whether a tier may be sold, whether this person may have it - none
// of that is answered here. It is answered in lib/tickets/seating.ts and issue.ts,
// under the event row lock, against the database. A forged layout posted at the save
// action reaches `venueLayoutSchema` below, and that is a validation, not a wall.
//
// ---- The coordinate system ------------------------------------------------
//
// One flat viewBox, in abstract units. Not pixels, not studs, not metres - units.
// The SVG scales it to whatever the browser has; lib/venue/anchor.ts maps it onto
// real Roblox studs. Nothing in the drawing knows or cares about either.
//
// Y grows DOWNWARD, because that is what SVG does and fighting it would mean every
// shape in the designer being flipped exactly once somewhere. The stage is normally
// at low Y (the "top" of the picture); the anchor is what decides where that lands
// in the world.

import { z } from "zod";

// ---- Section keys ----------------------------------------------------------

/**
 * A section key: "A1", "PIT", "GA", "B12".
 *
 * Constrained to [A-Z0-9] and nothing else, and that is not fussiness - it is what
 * lets a seat key be a plain string with a hyphen in it ("A1-K12") and be parsed
 * back apart by splitting on that hyphen. Allow a hyphen, a space or a unicode
 * dash in here and `parseSeatKey` has to become a real parser, `Ticket.seatKey`
 * stops being safely comparable, and somebody eventually names a section "A-1".
 *
 * Uppercase because a seat key ends up printed on a ticket and shouted across a
 * door, and "a1-k12" reads like a typo.
 */
export const SECTION_KEY = /^[A-Z0-9]{1,8}$/;

/** Row labels are letters: A, B, … Z, then AA, AB. See rowLabel() in seats.ts. */
export const ROW_LABEL = /^[A-Z]{1,2}$/;

const sectionKey = z
  .string()
  .trim()
  .toUpperCase()
  .regex(SECTION_KEY, "Section keys are 1-8 letters or digits, e.g. A1 or PIT");

// ---- Geometry --------------------------------------------------------------

const point = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

/**
 * The three shapes anybody actually draws a venue out of.
 *
 * There is no freehand path, and there will not be one: a section has to be
 * HIT-TESTED (which section did they click?) and FILLED WITH SEATS (where does row
 * K start?), and neither question has a sane answer for a squiggle. A polygon does
 * everything a real venue needs - curved balconies included, at enough points.
 */
const geom = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("rect"),
    x: z.number().finite(),
    y: z.number().finite(),
    w: z.number().finite().positive(),
    h: z.number().finite().positive(),
    /** Degrees, clockwise, about the rect's own centre. */
    rotation: z.number().finite().default(0),
  }),
  z.object({
    type: z.literal("ellipse"),
    cx: z.number().finite(),
    cy: z.number().finite(),
    rx: z.number().finite().positive(),
    ry: z.number().finite().positive(),
    rotation: z.number().finite().default(0),
  }),
  z.object({
    type: z.literal("polygon"),
    // 64 is generous - a smooth-looking curved balcony is about 20 - and it is a
    // cap rather than no cap because this is written from a browser and lands in a
    // Json column that the seat picker then renders on every page view of the show.
    points: z.array(point).min(3).max(64),
  }),
]);

export type Geom = z.infer<typeof geom>;

// ---- Rows ------------------------------------------------------------------

/**
 * How a seated section is filled with chairs.
 *
 * A SPEC, not four hundred rows. This is the whole reason there is no Seat table:
 * "12 rows of 20" is fourteen bytes and expands, deterministically and identically
 * on the client and the server, into the 240 seats it describes. See
 * lib/venue/seats.ts, which is the ONE function that does the expanding.
 */
const rowSpec = z.object({
  rows: z.number().int().min(1).max(60),
  seatsPerRow: z.number().int().min(1).max(80),

  /** The first row's letter. "A" unless the venue really does start at row J. */
  rowLabelStart: z.string().trim().toUpperCase().regex(ROW_LABEL).default("A"),

  /** The first seat's number. 1, unless this block continues another one. */
  seatStart: z.number().int().min(0).max(999).default(1),

  /**
   * Seats that do not exist: an aisle, a camera position, a wheelchair space that
   * is sold differently, a pillar. Seat keys, relative to this section - "K12".
   *
   * They are EXCLUDED from the seat list rather than marked unavailable, because a
   * seat that is not there is not the same thing as a seat nobody has bought, and
   * conflating the two puts a chair in an aisle on the picker.
   */
  skips: z.array(z.string().trim().toUpperCase()).max(400).default([]),

  /**
   * Curve, in units of vertical offset applied to the END of a row versus its
   * middle. 0 = a straight block. Positive bows the row away from the stage, which
   * is what a real seated tier does.
   */
  curve: z.number().finite().min(-200).max(200).default(0),

  /**
   * Rake: how much each row is INSET horizontally from the one in front. A stadium
   * tier narrows as it rises. 0 = a rectangle.
   */
  rake: z.number().finite().min(-50).max(50).default(0),
});

export type RowSpec = z.infer<typeof rowSpec>;

// ---- Shapes ----------------------------------------------------------------

/**
 * What a shape IS, and it decides everything about how it behaves:
 *
 *   SEATED_SECTION   sells numbered seats. Has a rowSpec. Buyers pick a chair.
 *   STANDING_AREA    sells a place in a crowd. Has a capacity. Buyers pick the area.
 *   STAGE            sells nothing. It is the thing everyone is looking at, and it
 *                    is on the map so the map is legible.
 *   GATE             sells nothing, but the DOOR reads it: which entrance is this
 *                    ticket for? A festival with four gates needs this to be a
 *                    property of the map, not a note in the description.
 *   DECOR            sells nothing, means nothing. Bars, toilets, the mixing desk.
 *   LABEL            text. Sells nothing.
 *
 * Only the first two are sellable, and `sellableShapes()` below is the one place
 * that decides which - so nothing has to re-derive it from a list of kinds and get
 * it wrong the day a seventh kind appears.
 */
export const SHAPE_KINDS = [
  "STAGE",
  "SEATED_SECTION",
  "STANDING_AREA",
  "GATE",
  "DECOR",
  "LABEL",
] as const;

export type ShapeKind = (typeof SHAPE_KINDS)[number];

const shapeBase = {
  /**
   * Stable across every edit of the map, and that is the entire contract. A
   * `Ticket.seatKey` of "A1-K12" points at the section whose key is "A1" and it
   * points at it FOREVER - so a designer renaming a section changes `name`, never
   * this. The designer never lets you edit it once seats have been sold; see
   * lib/venue/form.ts.
   */
  key: sectionKey,

  /** What a human calls it. "Front Barrier", "Balcony Left". Freely editable. */
  name: z.string().trim().min(1).max(60),

  geom,

  /** Paint order. Higher draws on top. */
  z: z.number().int().min(0).max(999).default(0),
};

/**
 * A sellable section, seated or standing.
 *
 * `tierId` is the join to the event's own tiers - and it is a plain string, NOT
 * validated against anything here, because this file is pure and has never heard of
 * a database. It is checked in lib/venue/form.ts, against THIS event's tiers, on
 * the way in. A tier id from another show matches nothing and the save is refused.
 */
const seatedSection = z.object({
  ...shapeBase,
  kind: z.literal("SEATED_SECTION"),
  tierId: z.string().trim().max(40).nullable().default(null),
  rows: rowSpec,
});

const standingArea = z.object({
  ...shapeBase,
  kind: z.literal("STANDING_AREA"),
  tierId: z.string().trim().max(40).nullable().default(null),
  /** 0 = uncapped by the area. The tier's cap and the room's still apply on top. */
  capacity: z.number().int().min(0).max(100_000).default(0),
});

const plainShape = z.object({
  ...shapeBase,
  kind: z.enum(["STAGE", "GATE", "DECOR", "LABEL"]),
});

const shape = z.discriminatedUnion("kind", [
  seatedSection,
  standingArea,
  plainShape,
]);

export type Shape = z.infer<typeof shape>;
export type SeatedSection = z.infer<typeof seatedSection>;
export type StandingArea = z.infer<typeof standingArea>;

/** The shapes that sell something. The ONE place that decides. */
export type SellableShape = SeatedSection | StandingArea;

export function isSellable(s: Shape): s is SellableShape {
  return s.kind === "SEATED_SECTION" || s.kind === "STANDING_AREA";
}

export function sellableShapes(layout: VenueLayout): SellableShape[] {
  return layout.shapes.filter(isSellable);
}

// ---- The anchor ------------------------------------------------------------

/**
 * Where this drawing IS, in the Roblox world.
 *
 * ONE anchor for the whole map, and that is a deliberate refusal to put six numbers
 * on every section. A per-shape anchor sounds more flexible and is: it is also six
 * hand-typed floats per section, in a 2D editor with no way to see whether they are
 * right, and they WILL be wrong. One anchor is verifiable by a human being - "the
 * stage is at 0,0,0 and the venue is 100 studs wide" - and everything else follows
 * from it affinely. See lib/venue/anchor.ts, which is twelve lines because of this.
 *
 * A venue that is genuinely non-planar (a balcony at a different height) is the case
 * this does not cover, and the answer when somebody actually has one is an OPTIONAL
 * per-section `yOffset`, not six floats everywhere. Nobody's first venue is.
 */
const anchor = z.object({
  /** The world position of the viewBox's ORIGIN (its top-left, 0,0). In studs. */
  origin: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite(),
  }),

  /** Studs per viewBox unit. The drawing's scale. */
  scale: z.number().finite().positive().max(1000).default(1),

  /** Degrees, clockwise, about the world Y axis. Which way the venue faces. */
  yaw: z.number().finite().default(0),
});

export type MapAnchor = z.infer<typeof anchor>;

// ---- The backdrop ----------------------------------------------------------

/**
 * A reference image to trace a room over: a promoter's PNG stage diagram, a
 * seating-plan screenshot, an architect's drawing. It is a DESIGN AID, not a seat
 * and not a section - it sells nothing and the allocator has never heard of it.
 *
 * ---- Why the url is constrained to /uploads/ -------------------------------
 *
 * This whole file is a SHAPE, not a wall (see the header). But `url` ends up in an
 * SVG `<image href>`, and this one field is the one place in a layout that points at
 * a RESOURCE rather than describing geometry - so it is worth pinning to our own
 * volume. It must be a root-relative `/uploads/...` path, which is exactly what
 * POST /api/uploads hands back. That does three things at once: it is same-origin
 * (an `<image>` cannot be pointed at an attacker's host to leak a referer or phone
 * home), it cannot carry a `javascript:`/`data:` scheme, and it can only ever name
 * a file that came through the authenticated upload door. A pasted external URL is
 * simply not a backdrop; upload the image instead.
 */
const backdrop = z.object({
  url: z
    .string()
    .trim()
    .max(300)
    .regex(
      /^\/uploads\/[A-Za-z0-9._\-/]+$/,
      "A backdrop must be an uploaded image (a /uploads/… path)",
    ),

  /** How strongly it shows through, 0–1. The designer's slider writes this. */
  opacity: z.number().finite().min(0).max(1).default(0.6),
}).nullable();

export type Backdrop = z.infer<typeof backdrop>;

// ---- The layout ------------------------------------------------------------

export const venueLayoutSchema = z.object({
  /** The drawing's own coordinate space. Everything is inside this. */
  viewBox: z.object({
    w: z.number().finite().positive().max(10_000),
    h: z.number().finite().positive().max(10_000),
  }),

  /** Grid spacing, in viewBox units. The designer snaps to it. Display only. */
  grid: z.number().finite().positive().max(500).default(10),

  /**
   * Nullable, because a venue is perfectly useful without one: the seat picker, the
   * ticket stub and the door do not care where the room is in the world. Only the
   * GAME does - it is what lets a booth build the seat map in 3D and spawn a holder
   * at their real chair - so a map with no anchor simply is not offered to it, and
   * everything else works exactly as before.
   */
  anchor: anchor.nullable().default(null),

  /**
   * A tracing image behind the shapes. Null by default, and rendered ONLY in the
   * designer (see venue-map.tsx's `showBackdrop`) - a buyer's seat picker never
   * shows the promoter's working diagram. It rides in the layout so it is there
   * again the next time the room is opened to be edited.
   */
  backdrop: backdrop.default(null),

  // 200 is well past any real venue (a stadium is a few dozen sections) and it is a
  // cap rather than no cap for the same reason polygon points are capped: a browser
  // writes this.
  shapes: z.array(shape).max(200),
});

export type VenueLayout = z.infer<typeof venueLayoutSchema>;

/** An empty room. What a new map starts as - and NEVER a parse failure's fallback. */
export function emptyLayout(): VenueLayout {
  return { viewBox: { w: 1000, h: 700 }, grid: 10, anchor: null, backdrop: null, shapes: [] };
}

/**
 * Read a layout that came out of the database.
 *
 * `VenueMap.layout` is a Json column, so Prisma hands it back as `unknown` and every
 * reader has to make the same decision about what to do with a row that does not
 * parse. They make it here, once, and the answer is NULL - never `emptyLayout()`.
 *
 * The difference matters more than it looks. A map that fails to parse is a BUG, and
 * an empty room is a perfectly ordinary thing for a venue to be. Collapse the two and
 * a seated show whose layout got corrupted silently renders as "general admission,
 * no map" - and sells the whole room again, over the top of four hundred people who
 * already have seats. The caller must decide what to do about null. It is not allowed
 * to not notice.
 */
export function parseLayout(value: unknown): VenueLayout | null {
  const parsed = venueLayoutSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// Where the chairs are.
//
// A seated section carries a SPEC - "12 rows of 20, rake 4, curve 15" - and this file
// is the one place that expands it into the 240 seats it describes.
//
// ONE place, and that is the entire point of the file. The SVG picker draws the seats
// by calling sectionSeats(); the server's allocator decides which are free by calling
// sectionSeats(). If those were two implementations, they would agree right up until
// somebody changed the rake formula in one of them, and then the picker would offer a
// chair the allocator does not believe exists - and a buyer would click it and be told
// no, forever, with both halves of the system certain they were right.
//
// It is the same rule that makes lib/tickets/barcode.ts shared between the SVG stub
// and the PNG download, and lib/tickets/pricing.ts shared between the server and the
// client. Two renderers of one fact must be one function.
//
// PURE. No prisma, no DOM, no "server-only". It runs in a React component and inside a
// database transaction, which is exactly why it may not reach for either.

import {
  isSellable,
  type Geom,
  type SeatedSection,
  type SellableShape,
  type VenueLayout,
} from "./schema";

// ---- Row labels ------------------------------------------------------------
//
// Bijective base-26: A…Z, then AA, AB. Not ordinary base-26, which has a zero and
// would give you a row called "A" twice.

export function rowLabelToIndex(label: string): number {
  return label
    .toUpperCase()
    .split("")
    .reduce((acc, c) => acc * 26 + (c.charCodeAt(0) - 64), 0);
}

export function indexToRowLabel(n: number): string {
  let out = "";
  let i = n;
  while (i > 0) {
    const r = (i - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    i = Math.floor((i - 1) / 26);
  }
  return out || "A";
}

// ---- Seat keys -------------------------------------------------------------

/**
 * "A1" + "K" + 12 -> "A1-K12".
 *
 * The hyphen is unambiguous because a section key cannot contain one - SECTION_KEY in
 * schema.ts is [A-Z0-9] and that restriction exists precisely so this can be a string
 * concatenation instead of a parser, and so `Ticket.seatKey` can be compared, indexed
 * and printed on a stub without any escaping anywhere.
 */
export function makeSeatKey(sectionKey: string, row: string, num: number) {
  return `${sectionKey}-${row}${num}`;
}

export type ParsedSeat = { sectionKey: string; row: string; number: number };

/** "A1-K12" -> { sectionKey: "A1", row: "K", number: 12 }. Null if it is not one. */
export function parseSeatKey(seatKey: string): ParsedSeat | null {
  const dash = seatKey.indexOf("-");
  if (dash <= 0) return null;

  const sectionKey = seatKey.slice(0, dash);
  const seat = seatKey.slice(dash + 1);

  const m = /^([A-Z]{1,2})(\d{1,3})$/.exec(seat);
  if (!m) return null;

  return { sectionKey, row: m[1], number: Number(m[2]) };
}

/**
 * What a ticket SAYS. "Section A1 · Row K · Seat 12", or "Front Barrier" for standing.
 *
 * Frozen onto the ticket at issue (Ticket.seatLabel) and never recomputed, so this is
 * called exactly once per ticket, at the moment it is sold - and the section's `name`
 * at that moment is the name the holder will see forever, whatever it gets renamed to.
 */
export function seatLabelFor(section: SellableShape, seat?: ParsedSeat | null) {
  if (!seat) return section.name;
  return `${section.name} · Row ${seat.row} · Seat ${seat.number}`;
}

// ---- Geometry --------------------------------------------------------------

type Box = { x: number; y: number; w: number; h: number };

/** The axis-aligned box a shape lives in, ignoring rotation. */
export function bounds(g: Geom): Box {
  if (g.type === "rect") return { x: g.x, y: g.y, w: g.w, h: g.h };
  if (g.type === "ellipse") {
    return { x: g.cx - g.rx, y: g.cy - g.ry, w: g.rx * 2, h: g.ry * 2 };
  }
  const xs = g.points.map((p) => p.x);
  const ys = g.points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** A shape's own rotation, in degrees. Polygons carry their rotation in their points. */
function rotationOf(g: Geom) {
  return g.type === "polygon" ? 0 : g.rotation;
}

function rotate(
  px: number,
  py: number,
  cx: number,
  cy: number,
  degrees: number,
) {
  if (!degrees) return { x: px, y: py };
  const r = (degrees * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = px - cx;
  const dy = py - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

// ---- The seats -------------------------------------------------------------

export type Seat = {
  /** "A1-K12". The value that lands in Ticket.seatKey. */
  key: string;
  row: string;
  number: number;
  /** Centre, in viewBox units. What the picker draws and anchor.ts maps to studs. */
  cx: number;
  cy: number;
};

/**
 * Expand a seated section into its chairs.
 *
 * Laid out inside the section's bounding box: rows down, seats across. Two knobs make
 * it look like a real venue rather than a spreadsheet -
 *
 *   rake   insets each row from the one in front, so a tier NARROWS as it climbs.
 *   curve  bows the ends of each row away from the middle, so a block FACES the stage
 *          instead of staring past it.
 *
 * - and then the whole thing is rotated by the shape's own rotation, so a block angled
 * at the stage has seats angled at the stage too. Rotation is applied LAST, to the
 * computed centres, rather than being baked into the row maths: the rows are laid out
 * in the shape's own frame and the frame is turned, which is both easier to reason
 * about and impossible to get subtly wrong the way rotating each row independently is.
 *
 * `skips` are removed rather than flagged, because a seat that is not there is not the
 * same thing as a seat nobody has bought. An aisle is not "sold out".
 */
export function sectionSeats(section: SeatedSection): Seat[] {
  const spec = section.rows;
  const box = bounds(section.geom);
  const spin = rotationOf(section.geom);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;

  const skip = new Set(spec.skips.map((s) => s.toUpperCase()));
  const firstRow = rowLabelToIndex(spec.rowLabelStart);

  const rowHeight = box.h / spec.rows;
  const seats: Seat[] = [];

  for (let r = 0; r < spec.rows; r++) {
    const row = indexToRowLabel(firstRow + r);

    // Each row is inset by the rake, so the block tapers. Guard the width: a rake
    // steep enough to invert a row would otherwise produce seats laid out backwards,
    // which renders as a section that mirrors itself halfway up.
    const inset = spec.rake * r;
    const rowWidth = Math.max(box.w - inset * 2, box.w * 0.1);
    const rowX = box.x + (box.w - rowWidth) / 2;
    const rowY = box.y + (r + 0.5) * rowHeight;

    const seatWidth = rowWidth / spec.seatsPerRow;

    for (let s = 0; s < spec.seatsPerRow; s++) {
      const number = spec.seatStart + s;
      const local = `${row}${number}`;
      if (skip.has(local)) continue;

      // -1 at the left end of the row, 0 in the middle, +1 at the right. Squared, so
      // the bow is smooth through the centre rather than a "V".
      const t = ((s + 0.5) / spec.seatsPerRow) * 2 - 1;

      const point = rotate(
        rowX + (s + 0.5) * seatWidth,
        rowY + spec.curve * t * t,
        cx,
        cy,
        spin,
      );

      seats.push({
        key: makeSeatKey(section.key, row, number),
        row,
        number,
        cx: point.x,
        cy: point.y,
      });
    }
  }

  return seats;
}

/**
 * How many chairs a section HAS. Not how many are left - this file has never heard of
 * a ticket. Counted rather than multiplied, because `skips` means rows × seats is a
 * lie.
 */
export function seatCapacity(section: SeatedSection): number {
  return sectionSeats(section).length;
}

/** Does this seat exist at all? The check that stops a hand-typed seatKey being sold. */
export function seatExists(layout: VenueLayout, seatKey: string): boolean {
  const parsed = parseSeatKey(seatKey);
  if (!parsed) return false;

  const section = layout.shapes.find(
    (s) => s.key === parsed.sectionKey && s.kind === "SEATED_SECTION",
  ) as SeatedSection | undefined;
  if (!section) return false;

  return sectionSeats(section).some((s) => s.key === seatKey);
}

// ---- Preference ------------------------------------------------------------

/**
 * Every seat for a tier, in the order somebody should be offered them.
 *
 * The order is: THE ORDER THE SECTIONS ARE IN, then row, then seat number.
 *
 * And "the order the sections are in" means their order in `layout.shapes` - which is
 * the layers list in the designer, which is a thing a human dragged into the order they
 * meant. That is deliberate, and it is the whole reason there is no "distance to stage"
 * calculation in here.
 *
 * Deriving best-available from geometry sounds obviously right and is a trap: it would
 * mean the front row of the side block beats the middle of the good block, because it is
 * three units nearer the stage. Nobody wants that seat, and no formula that has never
 * been to a gig is going to work out why. A promoter knows which sections are good. Let
 * them say so by dragging, and then just believe them.
 *
 * Used by BOTH the "Best available" button on the picker and the server's fallback when
 * a hold expired - so the seat the button promised is the seat the fallback gives.
 */
export function bestAvailableOrder(
  layout: VenueLayout,
  tierId: string | null,
): string[] {
  const out: string[] = [];

  for (const shape of layout.shapes) {
    if (shape.kind !== "SEATED_SECTION") continue;
    if ((shape.tierId ?? null) !== tierId) continue;
    for (const seat of sectionSeats(shape)) out.push(seat.key);
  }

  return out;
}

/** The sellable sections for a tier, in that same authored order. */
export function sectionsForTier(
  layout: VenueLayout,
  tierId: string | null,
): SellableShape[] {
  return layout.shapes
    .filter(isSellable)
    .filter((s) => (s.tierId ?? null) === tierId);
}

/**
 * How many people a section can hold, seated or standing.
 *
 * 0 from a standing area means UNCAPPED by the area - the tier's cap and the room's
 * still apply on top. It does not mean "nobody may stand here", and reading it that
 * way would close every pit that had not been given a number.
 */
export function sectionCapacity(section: SellableShape): number {
  return section.kind === "SEATED_SECTION"
    ? seatCapacity(section)
    : section.capacity;
}

/** Every seat in the room. What the designer warns against Event.capacity with. */
export function totalSeats(layout: VenueLayout): number {
  return layout.shapes.reduce(
    (n, s) => n + (s.kind === "SEATED_SECTION" ? seatCapacity(s) : 0),
    0,
  );
}

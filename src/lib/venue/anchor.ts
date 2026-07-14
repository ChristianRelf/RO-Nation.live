// Where a drawn seat IS, in the Roblox world.
//
// The bridge between a flat SVG the promoter drew in a browser and a chair a player
// walks up to inside the experience. It is what lets a walk-up booth build the seat
// map in 3D, and lets the game spawn a holder AT THEIR SEAT rather than at the door
// with a note telling them to go and find it.
//
// PURE, and tiny, and it is tiny ON PURPOSE.
//
// ---- Why there is one anchor and not one per section ----------------------
//
// The obvious design is a world position on every section: origin, right-vector,
// forward-vector, six floats each. It is more flexible, and it is a trap - because
// those six floats get typed by hand, into a number field, in a 2D editor that cannot
// show you whether they are right. They will be wrong, and they will be wrong silently:
// the map looks perfect and players spawn inside a wall.
//
// One anchor for the whole drawing is a claim a human can actually check - "the stage
// is at the world origin, the venue is 100 studs wide, it faces north" - and every seat
// follows from it by an affine transform, which is the twelve lines below. Wrong anchor,
// EVERYTHING is visibly in the wrong place, which is a bug you find in five seconds
// rather than one you find at a sold-out show.
//
// The case this does not cover is a genuinely non-planar venue - a balcony at a
// different height. The answer then is an OPTIONAL per-section height offset, not six
// floats everywhere. It is not needed yet, and adding it before it is needed would cost
// exactly the thing this file is protecting.

import type { MapAnchor, VenueLayout } from "./schema";

/** A Roblox world position, in studs. */
export type Vector3 = { x: number; y: number; z: number };

/**
 * A point in the drawing -> a point in the world.
 *
 * The drawing is flat and lies on the world's XZ plane (the ground). Its Y is the
 * anchor's Y, unchanged: everything in a venue is at floor height unless somebody
 * builds a balcony, and see the note above about what happens the day somebody does.
 *
 * SVG's Y grows DOWNWARD and Roblox's Z grows away from you, which happen to point the
 * same way once the drawing is laid flat - so a stage at the top of the picture is a
 * stage at low Z, and the audience is in front of it. That coincidence is why there is
 * no flip in here, and it is worth saying out loud, because the absence of a flip looks
 * like an omission until you know why.
 */
export function toWorld(anchor: MapAnchor, x: number, y: number): Vector3 {
  const r = (anchor.yaw * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);

  // Scale first, then spin about the origin, then translate. Any other order gives you
  // a venue that is the right shape in the wrong place, or the wrong shape entirely.
  const sx = x * anchor.scale;
  const sz = y * anchor.scale;

  return {
    x: anchor.origin.x + sx * cos - sz * sin,
    y: anchor.origin.y,
    z: anchor.origin.z + sx * sin + sz * cos,
  };
}

/**
 * The world position of a seat, given the layout it lives in.
 *
 * Null when the map has no anchor - which is a perfectly ordinary state, not a failure.
 * A venue is completely useful on the web without ever being placed in the world; only
 * the GAME needs this. So the caller gets null and simply does not offer 3D, rather than
 * being handed a plausible-looking (0,0,0) that puts every seat in the same spot.
 */
export function seatWorld(
  layout: VenueLayout,
  cx: number,
  cy: number,
): Vector3 | null {
  if (!layout.anchor) return null;
  return toWorld(layout.anchor, cx, cy);
}

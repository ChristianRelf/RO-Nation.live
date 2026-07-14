import { TEMPLATE_H, TEMPLATE_W, type Net, type Rect } from "./template";

// Turning a template rectangle into UVs for a three.js BoxGeometry.
//
// Pure, and separate from the viewer, entirely so it can be TESTED. The viewer needs
// a GPU and a browser; this needs neither, and it is where all the ways to be subtly
// wrong actually live:
//
//   • the faces of a BoxGeometry come in a fixed, non-obvious order
//   • a template rectangle is measured from the top-left, and UV space starts at the
//     bottom-left, so v has to be flipped
//   • the character faces the camera, so its RIGHT is the viewer's LEFT
//
// None of those fail loudly. They produce a shirt with the sleeves swapped, or the
// logo mirrored, or the back panel upside down - all of which look like bad artwork
// rather than a bug, and all of which survive a glance. So the mapping is checked
// against Roblox's own colour-coded template, where every face is a different colour
// and says its own name.

/**
 * The order three.js lays out the six faces of a BoxGeometry, and what each one is
 * on a character who faces +Z (toward the camera).
 *
 * The +X face is the character's LEFT. This is not a typo and it is the single
 * easiest thing here to get backwards: if you are looking at someone, their right
 * hand is on your left.
 */
export const FACE_ORDER: readonly (keyof Net)[] = [
  "left", // +X
  "right", // -X
  "up", // +Y
  "down", // -Y
  "front", // +Z - toward the viewer
  "back", // -Z
];

export type UVRect = { u0: number; u1: number; vTop: number; vBottom: number };

/**
 * A pixel rectangle → UV coordinates.
 *
 * The v flip is here. Template rectangles are measured from the TOP of the image,
 * because that is how a person reads a picture; UV space puts v=0 at the BOTTOM,
 * because that is how OpenGL reads one. Forget it and every panel is upside down.
 */
export function rectToUV(r: Rect): UVRect {
  return {
    u0: r.x / TEMPLATE_W,
    u1: (r.x + r.w) / TEMPLATE_W,
    vTop: 1 - r.y / TEMPLATE_H,
    vBottom: 1 - (r.y + r.h) / TEMPLATE_H,
  };
}

/**
 * The full 24-entry UV buffer for one cube net, in three.js's face order.
 *
 * Each face gets four vertices, and three.js orders them top-left, top-right,
 * bottom-left, bottom-right *as seen from outside the box* - so writing the rect's
 * corners in that same order is what keeps the artwork the right way up and the
 * right way round.
 */
export function netUVs(net: Net): Float32Array {
  const out = new Float32Array(24 * 2);

  FACE_ORDER.forEach((face, i) => {
    const { u0, u1, vTop, vBottom } = rectToUV(net[face]);
    const o = i * 8;

    out[o + 0] = u0;
    out[o + 1] = vTop; // top-left
    out[o + 2] = u1;
    out[o + 3] = vTop; // top-right
    out[o + 4] = u0;
    out[o + 5] = vBottom; // bottom-left
    out[o + 6] = u1;
    out[o + 7] = vBottom; // bottom-right
  });

  return out;
}

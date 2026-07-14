// The classic clothing template, as a UV layout.
//
// ---- Where these numbers come from ----------------------------------
//
// They were MEASURED, not remembered. Roblox publishes the official classic
// clothing templates as a ZIP:
//
//   https://prod.docsiteassets.roblox.com/assets/accessories/classic-clothing/Classic-Clothing-Templates.zip
//
// The templates are colour-coded - every face of every limb is a flat, distinct
// colour - so each rectangle below is the exact bounding box of one of those colour
// regions, extracted from the PNG by connected-component analysis. Both the shirt
// and the pants template have byte-identical geometry; only the labels differ.
//
// That matters because this is the one part of the shop that cannot be *slightly*
// wrong. A UV rect off by a few pixels does not throw and does not look broken - it
// looks like a shirt with a seam in the wrong place, which reads as "the artwork is
// bad" rather than "the code is bad". So none of it was eyeballed.
//
// ---- The layout ------------------------------------------------------
//
// 585 × 559, and 64 pixels to a Roblox stud. Three cube nets:
//
//   TORSO      2 × 2 × 1 studs  → front/back 128×128, sides 64×128, top/bottom 128×64
//   RIGHT LIMB 1 × 2 × 1 studs  → every side 64×128, ends 64×64
//   LEFT LIMB  1 × 2 × 1 studs  → mirrored from the right one
//
//   Shirt  → torso + right arm + left arm
//   Pants  → torso + right leg + left leg   (yes, pants texture the torso too; a
//            shirt is simply drawn over the top of it)
//
// R and L below are the CHARACTER's right and left, which is the viewer's left and
// right - the usual source of a mirrored logo.

/** A rectangle in template pixels, measured from the TOP-left of the image. */
export type Rect = { x: number; y: number; w: number; h: number };

/** The six faces of one cube net. */
export type Net = {
  front: Rect;
  back: Rect;
  /** The character's right side. */
  right: Rect;
  /** The character's left side. */
  left: Rect;
  up: Rect;
  down: Rect;
};

export const TEMPLATE_W = 585;
export const TEMPLATE_H = 559;

export const TORSO: Net = {
  right: { x: 165, y: 74, w: 64, h: 128 },
  front: { x: 231, y: 74, w: 128, h: 128 },
  left: { x: 361, y: 74, w: 64, h: 128 },
  back: { x: 427, y: 74, w: 128, h: 128 },
  up: { x: 231, y: 8, w: 128, h: 64 },
  down: { x: 231, y: 204, w: 128, h: 64 },
};

/** Right arm on a shirt; right leg on pants. Same rectangles either way. */
export const RIGHT_LIMB: Net = {
  left: { x: 19, y: 355, w: 64, h: 128 },
  back: { x: 85, y: 355, w: 64, h: 128 },
  right: { x: 151, y: 355, w: 64, h: 128 },
  front: { x: 217, y: 355, w: 64, h: 128 },
  up: { x: 217, y: 289, w: 64, h: 64 },
  down: { x: 217, y: 485, w: 64, h: 64 },
};

/** Left arm on a shirt; left leg on pants. Note the strip runs the other way. */
export const LEFT_LIMB: Net = {
  front: { x: 308, y: 355, w: 64, h: 128 },
  left: { x: 374, y: 355, w: 64, h: 128 },
  back: { x: 440, y: 355, w: 64, h: 128 },
  right: { x: 506, y: 355, w: 64, h: 128 },
  up: { x: 308, y: 289, w: 64, h: 64 },
  down: { x: 308, y: 485, w: 64, h: 64 },
};

/**
 * A T-Shirt is not a shirt.
 *
 * assetTypeId 2 is a plain square image slapped on the FRONT of the torso - no
 * template, no wrap, no sleeves. assetTypeId 11 ("Shirt") is the full box unwrap
 * above. They are different assets with different art, and rendering one as the
 * other is the single most likely way for this viewer to look confidently wrong.
 *
 * RNL's current merch is all type 11, despite every item being named "…tee".
 */
export const TSHIRT_FRONT: Rect = { x: 0, y: 0, w: 1, h: 1 };

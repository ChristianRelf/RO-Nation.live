/**
 * The deck cover's backdrop, with nothing on it.
 *
 *   npm run brand:backdrop                    # 1200x800, the cover's own size
 *   npm run brand:backdrop -- 2400 1600       # any size you like
 *   npm run brand:backdrop -- 1920 1080 out.png
 *
 * ---- Why this is drawn and not cropped -------------------------------------
 *
 * public/brand/brandassets/deckCover.png has the wordmark sitting in the middle of the
 * glow, so there is no clean region to lift and no honest way to paint it out - the
 * brightest part of the gradient is exactly the part the letters cover. What there IS is
 * a composition simple enough to describe exactly, so this describes it: one flat field,
 * one elliptical glow, a column grid and a hairline frame.
 *
 * The numbers below are not guesses. They were fitted against the cover's own pixels
 * (least squares over ~20k background samples, masking the glyphs, the rules and the
 * frame), and the reconstruction lands within ~1/255 per channel of the original. So this
 * is the same backdrop, not one that looks a bit like it - which is the point, since art
 * made on it has to sit next to the cover.
 *
 * Everything is expressed as a FRACTION of the canvas, so a 4K render is the 1200x800 one
 * zoomed rather than the same hairlines stranded on a bigger field. That includes the line
 * weights: a 1px frame on a 3840px poster is not a frame, it is a rendering artefact.
 */

import { writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";

/** The flat field everything sits on. */
const BASE = "#0f0f0f";

/**
 * The glow. blue-600 at 35.3% over the base, falling to nothing at the edge of an ellipse
 * centred slightly above the middle - which is what stops the composition sitting like a
 * bullseye. The 2.4 exponent is the shape of the falloff and matters more than it looks:
 * a linear ramp reads as a spotlight, and a Gaussian never quite reaches the corners.
 */
const GLOW = {
  color: "#2563eb",
  opacity: 0.353,
  cx: 0.5,
  cy: 0.37875,
  rx: 920 / 1200,
  ry: 620 / 800,
  falloff: 2.4,
};

/** 14 columns, so 13 rules. Barely visible on purpose - texture, not a grid you read. */
const COLUMNS = 14;
const RULE_OPACITY = 0.058;

/** The hairline that makes it read as a plate rather than a bleed. */
const FRAME_OPACITY = 0.117;

/** Line weights are quoted at the cover's own width and scale from there. */
const REFERENCE_WIDTH = 1200;

/**
 * The falloff as gradient stops.
 *
 * SVG interpolates linearly between stops, so the curve is approximated by sampling it -
 * 24 steps, which is under a 1/255 error and therefore invisible. Only the opacity varies
 * across the stops (the hue never moves), so how the renderer handles premultiplied alpha
 * cannot change the result.
 */
function stops(): string {
  const out: string[] = [];
  for (let i = 0; i <= 24; i++) {
    const d = i / 24;
    const opacity = GLOW.opacity * Math.pow(1 - d, GLOW.falloff);
    out.push(
      `<stop offset="${d.toFixed(4)}" stop-color="${GLOW.color}" stop-opacity="${opacity.toFixed(5)}"/>`,
    );
  }
  return out.join("");
}

function backdropSvg(width: number, height: number): string {
  const scale = width / REFERENCE_WIDTH;
  const cx = GLOW.cx * width;
  const cy = GLOW.cy * height;
  const rx = GLOW.rx * width;
  const ry = GLOW.ry * height;

  // A radial gradient is a circle; the ellipse comes from squashing it about its own
  // centre, which is what the translate/scale/translate sandwich is doing.
  const squash = `translate(${cx} ${cy}) scale(1 ${(ry / rx).toFixed(6)}) translate(${-cx} ${-cy})`;

  const rules = Array.from({ length: COLUMNS - 1 }, (_, i) => {
    const x = ((i + 1) / COLUMNS) * width;
    return `<rect x="${(x - scale / 2).toFixed(3)}" y="0" width="${scale}" height="${height}" fill="#ffffff" fill-opacity="${RULE_OPACITY}"/>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><radialGradient id="glow" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${rx}" gradientTransform="${squash}">${stops()}</radialGradient></defs>
<rect width="${width}" height="${height}" fill="${BASE}"/>
<rect width="${width}" height="${height}" fill="url(#glow)"/>
${rules}
<rect x="${scale / 2}" y="${scale / 2}" width="${width - scale}" height="${height - scale}" fill="none" stroke="#ffffff" stroke-opacity="${FRAME_OPACITY}" stroke-width="${scale}"/>
</svg>`;
}

async function main() {
  const args = process.argv.slice(2);
  const width = Number(args[0] ?? 1200);
  const height = Number(args[1] ?? 800);
  const out = args[2] ?? "public/brand/brandassets/deckBackdrop.png";

  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 16 || height < 16) {
    console.error("\n✗ Usage: npm run brand:backdrop -- [width] [height] [outfile]\n");
    process.exit(1);
  }

  const png = await sharp(Buffer.from(backdropSvg(width, height)))
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeFile(path.resolve(out), png);
  console.log(`\n✓ ${out}  ${width}x${height}  ${(png.length / 1024).toFixed(0)} kB\n`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

// How a shirt hangs on the rail.
//
// Shirts pegged up by hand are not a CSS grid: they sit at slightly different
// heights and slightly different angles. That is the difference between a merch
// table and a product listing, and it costs nine lines.
//
// It is DERIVED FROM THE SLUG, and never random. This is the important part, and it
// is the bug you would otherwise spend an hour chasing: these components render on
// the server and hydrate on the client, so a Math.random() here would produce one
// set of angles in the HTML and a different set on hydration. React would either
// scream about a mismatch or silently re-lay the whole wall the instant it becomes
// interactive - a rail that visibly reshuffles itself a beat after it appears.
//
// A hash of the slug is stable, so the same shirt hangs the same way on every render,
// on every machine, forever - while the wall as a whole still looks hand-hung.

export type Hang = {
  /** Extra top padding, px. How far down the peg it slipped. */
  hang: number;
  /** Its resting angle, deg. */
  rot: number;
};

const HANGS = [0, 8, 16, 6] as const;
const ROTS = [-1.6, 0, 1.6, -0.8] as const;

export function hangOffset(slug: string): Hang {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    // A plain rolling sum. It does not need to be a good hash - it needs to be the
    // SAME hash on the server and in the browser, and to spread a dozen slugs across
    // four buckets without clumping.
    h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  }

  return {
    hang: HANGS[h % HANGS.length],
    // A second, offset draw, so hang and rotation do not correlate - otherwise every
    // shirt that hangs low also leans the same way, and the eye reads the pattern
    // immediately.
    rot: ROTS[(h >>> 3) % ROTS.length],
  };
}

/** The angle a swing tag was pinned on at. Same reasoning, different draw. */
export function tagRotation(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 17 + slug.charCodeAt(i)) >>> 0;
  return [2.5, -3, 4, -1.5][h % 4];
}

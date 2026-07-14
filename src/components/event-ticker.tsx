// A Live-Nation-style scrolling marquee on a bold accent band. Pure CSS, no JS.
//
// The band is filled with the brand accent, so everything drawn on it is
// `accent-ink` - the ink that is readable on that fill. On RNL that is white;
// on a brand with a light accent it flips to near-black. The hairline is the
// page background, which fences the band off from the page whichever way round
// the two are.
//
// Two identical strips sit side by side, and each slides left by its own full
// width. By the time the first has gone, the second is sitting exactly where the
// first began - so the loop restarts on identical pixels and the seam is
// invisible.
//
// `min-w-full` makes each strip at least as wide as the band, so the pair always
// spans at least two screens and no blank can scroll into view - even with one
// event, or none.
//
// Spacing: `justify-around` gives every item equal space either side, and the
// trailing `pr-5` matches `gap-5`, so the space across the seam comes out the
// same as the space between any two items. Change one and you must change the
// other, or the join will show.

function Strip({ items, hidden }: { items: string[]; hidden?: boolean }) {
  return (
    <div
      aria-hidden={hidden}
      className="flex min-w-full shrink-0 animate-marquee items-center justify-around gap-5 whitespace-nowrap pr-5"
    >
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-5">
          <span className="font-display text-sm tracking-tight text-accent-ink">
            {item}
          </span>
          <span className="text-[9px] text-accent-ink/60">◆</span>
        </span>
      ))}
    </div>
  );
}

export function EventTicker({ items }: { items: string[] }) {
  const row = items.length ? items : ["More shows dropping soon"];

  // Repeat until there's enough to read as a continuous stream rather than a
  // couple of words drifting across an empty band.
  const strip = [...row];
  while (strip.length < 8) strip.push(...row);

  return (
    <div className="relative flex select-none overflow-hidden border-y border-bg/20 bg-accent py-2.5">
      <Strip items={strip} />
      <Strip items={strip} hidden />
    </div>
  );
}

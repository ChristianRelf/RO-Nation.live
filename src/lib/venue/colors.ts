// What colour is a seat?
//
// PURE, and it returns a CSS custom property REFERENCE - never a hex, never an rgb()
// with numbers in it. `rgb(var(--seat-tier-2-rgb))` goes straight into an SVG `fill`,
// the browser resolves it, and a partner who has overridden that channel in
// styles/brands/<slug>.css gets their own colour with nothing here knowing about it.
//
// That is the rule the whole design system runs on (see the long note at the top of the
// venue block in globals.css) and it is the reason the map needs no colour-resolution
// step at all. Put a hex in here and you have quietly hardcoded RNL's blue into every
// partner's seat map.

/** How many price bands have a colour of their own. See globals.css. */
export const TIER_COLOURS = 6;

/**
 * The colour for the Nth price band, as a CSS value.
 *
 * Wraps past six, because six is a design decision and not a limit on how many tiers
 * somebody may create - and a seventh tier that renders as an invisible seat would be a
 * far worse failure than a seventh tier that shares a colour with the first. A show with
 * seven price bands has bigger legibility problems than this function.
 */
export function tierColour(index: number): string {
  const n = (((index % TIER_COLOURS) + TIER_COLOURS) % TIER_COLOURS) + 1;
  return `rgb(var(--seat-tier-${n}-rgb))`;
}

/** The same colour, faded. For a section fill under its own seats. */
export function tierColourSoft(index: number, alpha = 0.18): string {
  const n = (((index % TIER_COLOURS) + TIER_COLOURS) % TIER_COLOURS) + 1;
  return `rgb(var(--seat-tier-${n}-rgb) / ${alpha})`;
}

/**
 * What a seat looks like, by state.
 *
 * `free` is the odd one out and deliberately so: it is NULL, meaning "colour me by my
 * price band instead". A free seat's colour is its price - that is the entire idea the
 * map is built on, and --seat-free-rgb exists only as the fallback for a section with no
 * tier assigned yet, which is a thing that only happens inside the designer.
 */
export type SeatState = "free" | "taken" | "held" | "selected";

export function seatColour(state: SeatState, tierIndex: number | null): string {
  if (state === "taken") return "rgb(var(--seat-taken-rgb))";
  if (state === "held") return "rgb(var(--seat-held-rgb))";
  if (state === "selected") return "rgb(var(--seat-selected-rgb))";
  return tierIndex === null ? "rgb(var(--seat-free-rgb))" : tierColour(tierIndex);
}

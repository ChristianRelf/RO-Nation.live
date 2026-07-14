import "server-only";
import { prisma } from "@/lib/db";
import {
  findIntent,
  seatAvailability,
  type SeatAvailability,
} from "@/lib/tickets/intents";
import { parseLayout, type VenueLayout } from "./schema";
import { sectionsForTier } from "./seats";

// Should this buyer be shown a seat map at all?
//
// One function, two pages (RNL's and every partner's), and - the part that actually matters -
// ONE decision tree, which is resolveSeat()'s. The picker must be shown if and only if the
// allocator would give this person a seat. Get that wrong in either direction and it is bad
// in a different way:
//
//   shown when it shouldn't be    an empty map, no clickable chair, a dead Continue button,
//                                 and no explanation. The buyer is simply stuck.
//   skipped when it shouldn't be  they are never offered a seat, the server allocates one
//                                 anyway, and they find out where they are sitting when the
//                                 ticket arrives.
//
// So the three cases below are lifted straight from resolveSeat, in its order:
//
//     if (seatMode === "NONE" || !layout) return UNSEATED;      -> skip
//     const order = sectionsForTier(...); if (!order.length)    -> skip
//
// That second one is the subtle one and it is deliberate: AN UNMAPPED TIER SELLS EXACTLY AS
// IT DOES TODAY. A promoter can map two of their three tiers and the third keeps working as
// general admission - so the buyer on that third tier must not be sent to a map with nothing
// on it for them.

export type PickerData =
  /** Show the picker. */
  | { state: "pick"; layout: VenueLayout; seatMode: "SECTION" | "SEAT"; availability: SeatAvailability }
  /** There is no seat to pick. Go straight to checkout, exactly as an unseated show does. */
  | { state: "skip" }
  /**
   * A seated show whose map does not parse.
   *
   * REFUSE. Not "no map, sell it as GA" - that is the failure parseLayout() exists to
   * prevent, and on a sold show it would put the whole room back on sale over the top of
   * everybody already holding a seat. createPurchaseIntent refuses this too (`unavailable`),
   * so this is the same wall, one page earlier, where it can be a sentence instead of a
   * bounce.
   */
  | { state: "broken" };

export async function seatPickerFor(
  event: { id: string; seatMode: "NONE" | "SECTION" | "SEAT"; venueMapId: string | null },
  /** "" is the implicit General Admission tier - the same string its radio submits. */
  tierId: string,
): Promise<PickerData> {
  if (event.seatMode === "NONE" || !event.venueMapId) return { state: "skip" };

  const map = await prisma.venueMap.findUnique({
    where: { id: event.venueMapId },
    select: { layout: true },
  });
  if (!map) return { state: "skip" };

  const layout = parseLayout(map.layout);
  if (!layout) return { state: "broken" };

  // Nobody drew a section for this tier. Not an error - see the note above.
  if (sectionsForTier(layout, tierId || null).length === 0) return { state: "skip" };

  const availability = await seatAvailability(event.id);
  if (!availability) return { state: "skip" };

  return { state: "pick", layout, seatMode: event.seatMode, availability };
}

/**
 * Is this hold token, off a query string, actually theirs to spend?
 *
 * The checkout page asks before it renders a purchase animation over the top of it. The
 * query string is not evidence of anything - that file's own header says so - and a token
 * is the most tempting thing in it to believe.
 *
 * ---- The checks are issueTicket's checks, on purpose ------------------------
 *
 * Same list, same order, minus the ones a web buyer cannot trip. If this page refused a hold
 * the authority would have honoured, the buyer would be bounced back to the map for a seat
 * they were about to be given - so the two must agree, and the way to make two things agree
 * is to write one of them down and point at it.
 *
 * WHICH IS WHY EXPIRY IS NOT CHECKED HERE.
 *
 * An expired hold is not a refusal. issueTicket says so at length: what an expiry costs
 * somebody is the SEAT THEY PICKED, not the ticket they came for - it falls back to the best
 * available chair in the same tier and issues it. Refusing an expired token here would
 * reintroduce, one page earlier, exactly the failure that fallback exists to prevent. Let
 * them through; they may end up in a different chair, and the bar told them the clock was
 * running.
 *
 * `userId` IS checked, and it is the one addition. issueTicket takes the holder FROM THE
 * INTENT rather than from the caller - which makes a leaked token safe (it cannot be
 * redirected onto somebody else) but means a token pasted into somebody else's URL would
 * quietly mint a ticket for its real owner and then navigate the wrong person to it. Not
 * dangerous; just nonsense. Refusing it here turns nonsense into a clean trip back to the map.
 */
export async function holdIsSpendable(input: {
  token: string;
  eventId: string;
  tierId: string;
  userId: string;
}): Promise<boolean> {
  if (!input.token) return false;

  const intent = await findIntent(input.token);
  if (!intent) return false;

  if (intent.eventId !== input.eventId) return false;
  if ((intent.tierId ?? "") !== (input.tierId ?? "")) return false;
  if (intent.status !== "PENDING") return false;
  if (intent.userId !== input.userId) return false;

  return true;
}

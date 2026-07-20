// THE TICKET TERMS. One copy, and there used to be two.
//
// ---- What went wrong, and why this file exists ----------------------------
//
// The clauses were a hardcoded array in the reserve page. Then partners got shows,
// and the partner reserve page got its own array - the same five lines, retyped, in
// template literals instead of quotes, with a different fifth clause.
//
// They drifted, because of course they did. Whoever edited one could not see the
// other: nothing links them, nothing imports anything, and "the ticket terms" was
// not a thing in this codebase that you could go and look at. Both copies still
// carried a clause promising that entry is verified "using your ticket code - have
// it ready", which describes a door this site does not have and never did (the
// game checks people in by Roblox id - see lib/tickets/verify.ts). One sentence,
// wrong in two places, for as long as there have been two places.
//
// So: one module, two levels of resolution, and a snapshot frozen onto every ticket
// at issue.
//
// ---- The resolution order ---------------------------------------------------
//
//   event.ticketTerms, if the organiser wrote any     →  the show's own terms
//   otherwise                                          →  the issuer's default
//
// TWO LEVELS, NOT THREE. A partner-level override table would be a third place to
// look for prose that has just finished being in two, and no partner has yet wanted
// terms that differ from RNL's beyond the disclaimer - which they already have, on
// the Partner record, for the footer.

import { ticketBrand } from "./brand";

type Organiser = {
  /** Whose name goes in the "may cancel or reschedule" clause. */
  name: string;
  /**
   * The fan-event disclaimer, for a partner who runs tribute shows.
   *
   * Read straight off the Partner record rather than retyped here - it is the same
   * sentence as the one under their footer, and two copies of THAT is the exact
   * mistake this file exists to undo.
   */
  disclaimer?: string;
};

/**
 * What a ticket means, when the organiser has not said otherwise.
 *
 * Note the second clause. It used to promise a door check "using your ticket code".
 * What actually happens is that you join the experience and the game asks this site
 * who you are - so that is what it says now.
 */
export function defaultTicketTerms(organiser: Organiser): string[] {
  const terms = [
    "Your ticket admits one person and is tied to your Roblox account - it can't be transferred or resold.",
    "You're checked in automatically when you join the experience, using the Roblox account this ticket was issued to.",
    `${organiser.name} may cancel, reschedule, or change the line-up of any event.`,
    "You agree to follow Roblox Community Standards and event moderation while attending.",
    "Reserving a ticket you don't use may affect priority for future events.",
  ];

  // Last, and only when there is one. It is the clause that says what this event
  // actually is, so it reads better after the ones about what a ticket does.
  if (organiser.disclaimer) terms.push(organiser.disclaimer);

  return terms;
}

/**
 * Whose terms these are, from the show's partner scope.
 *
 * Built on ticketBrand() rather than looking the partner up again, for the reason
 * that file gives about the mark and the code prefix: the name in the terms and the
 * name printed on the ticket must be the same name, and the way to guarantee that
 * is to ask the same function.
 */
export function organiserFor(partnerId: string | null | undefined): Organiser {
  const brand = ticketBrand(partnerId);
  return { name: brand.name, disclaimer: brand.partner?.disclaimer };
}

/** The terms in force for a show right now - the override if there is one, else the default. */
export function ticketTermsFor(
  event: { ticketTerms: string[] },
  organiser: Organiser,
): string[] {
  return event.ticketTerms.length
    ? event.ticketTerms
    : defaultTicketTerms(organiser);
}

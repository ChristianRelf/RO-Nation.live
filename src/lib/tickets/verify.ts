import "server-only";
import { prisma } from "@/lib/db";
import { resolveRobloxUser } from "@/lib/roblox-users";
import { ticketSeal } from "./seal";

// The one place that decides whether a ticket gets somebody through the door.
//
// It is shared by the game API (/api/v1/tickets/verify and /redeem) and by the
// manual check a crew member does on the web. That sharing is the point: a door
// where the scanner says ADMIT and the laptop says REFUSE is worse than having no
// laptop, and two copies of this logic would eventually say exactly that.
//
// Two rules, both learned the hard way:
//
//   SCOPE IS NOT OPTIONAL. A ticket is valid FOR A SHOW. Looking one up by code
//   alone and answering "valid: true" is how a ticket for last month's event opens
//   tonight's door — the code is real, the ticket is real, and the answer is still
//   wrong. Pass `eventId` whenever you know it, and this refuses a mismatch.
//
//   THE TIER IS READ FROM THE TICKET, not from the tier row it points at. The tier
//   may since have been renamed, re-priced or deleted, and none of that changes
//   what this person actually holds.

export type VerifyReason =
  | "ok"
  | "not_found"
  | "cancelled"
  | "wrong_event"
  | "already_checked_in";

export type Admission = {
  /** The tier's name as it was when the ticket was issued. */
  tier: string;
  /** "GA" for free general admission, "VIP" for anything that was priced. */
  kind: "GA" | "VIP";
  priceRobux: number;
  paid: boolean;
};

export type VerifyResult = {
  /** The ticket exists and has not been cancelled. */
  valid: boolean;
  /**
   * Should the door let them through RIGHT NOW?
   *
   * Deliberately separate from `valid`. An already-checked-in ticket is perfectly
   * valid and must NOT admit a second person — that is the whole point of
   * redeeming. The game should branch on this, not on `valid`.
   */
  admit: boolean;
  reason: VerifyReason;
  /** A line a human can read out. The crew UI and the game both show this. */
  message: string;
  ticket: {
    id: string;
    code: string;
    status: "RESERVED" | "CHECKED_IN" | "CANCELLED";
    admission: Admission;
    activated: boolean;
    activatedAt: Date | null;
    checkedIn: boolean;
    checkedInAt: Date | null;
    /** The seal printed on the ticket. See lib/tickets/seal.ts. */
    seal: string;
    /**
     * Only present when the caller SENT a seal to be checked.
     *
     * true  — it matches; the printed ticket is genuine.
     * false — it does not; treat the ticket as forged and look at it properly.
     */
    sealValid?: boolean;
  };
  event: {
    id: string;
    slug: string;
    title: string;
    startsAt: Date;
    doorsAt: Date | null;
    venue: string | null;
    /** The partner whose show this is, or null for RO. Nation LIVE's own. */
    partnerId: string | null;
  };
  holder: {
    robloxId: string;
    username: string;
    displayName: string;
  };
} | {
  valid: false;
  admit: false;
  reason: "not_found" | "wrong_event";
  message: string;
  ticket: null;
  event: null;
  holder: null;
};

export type LookupInput = {
  /** The printed code, "RN-4K9QW2". Case-insensitive. */
  code?: string | null;
  /** With `eventId`, the other way to find a ticket: who is standing here. */
  robloxId?: string | null;
  /**
   * The same question asked by name — "chrxs_dev". Also needs `eventId`.
   *
   * Resolved to a robloxId before anything is looked up. See resolveHolderId():
   * a username is a label a player can change, not an identity.
   */
  username?: string | null;
  /** The show this door belongs to. Pass it whenever you know it — see above. */
  eventId?: string | null;
  /** The seal printed on the ticket, if the crew typed it in. Optional. */
  seal?: string | null;
  /**
   * Restrict to one org's shows: a partner slug, or null for RNL's own.
   *
   * `undefined` means "don't scope" — the game API, which is keyed per
   * deployment. The WEB door always passes it, so a partner's crew cannot look up
   * a ticket for a show that isn't theirs.
   */
  scope?: string | null;
};

/** Neither identifier given — the caller has not asked a question we can answer. */
export const BAD_REQUEST = "bad_request" as const;

export async function checkTicket(
  input: LookupInput,
): Promise<VerifyResult | typeof BAD_REQUEST> {
  const code = input.code ? input.code.trim().toUpperCase() : null;
  const robloxId = input.robloxId ? String(input.robloxId).trim() : null;
  const username = input.username ? String(input.username).trim() : null;
  const eventId = input.eventId ? String(input.eventId).trim() : null;

  // A holder is only an answer to "which ticket" once you know which show. One
  // person can hold a ticket to every show we run, so a name with no eventId is
  // an ambiguous question, not a lookup.
  if (!code && !((robloxId || username) && eventId)) return BAD_REQUEST;

  let ticket = null;
  if (code) {
    ticket = await prisma.ticket.findUnique({
      where: { code },
      include: { event: true, user: true },
    });
  } else {
    const holderId = robloxId ?? (await resolveHolderId(username!));
    ticket = holderId ? await lookupByHolder(holderId, eventId!) : null;
  }

  // Say what was actually asked. "No ticket with that code" in response to a
  // username sends the crew hunting for a code nobody typed.
  const nothing = code ? "No ticket with that code." : "No ticket for that player.";

  const missing = (reason: "not_found" | "wrong_event", message: string) =>
    ({ valid: false, admit: false, reason, message, ticket: null, event: null, holder: null }) as const;

  if (!ticket) return missing("not_found", nothing);

  // Scope, twice over. `scope` keeps a partner's crew out of RNL's tickets (and
  // each other's); `eventId` keeps a real ticket for another show from opening
  // tonight's door. Both answer "not this door" rather than leaking what the
  // ticket actually is.
  if (input.scope !== undefined && (ticket.event.partnerId ?? null) !== input.scope) {
    return missing("not_found", nothing);
  }
  if (eventId && ticket.eventId !== eventId) {
    return missing("wrong_event", "That ticket is for a different show.");
  }

  const priceRobux = ticket.priceRobux ?? 0;
  const admission: Admission = {
    tier: ticket.tierName ?? "General Admission",
    kind: priceRobux > 0 ? "VIP" : "GA",
    priceRobux,
    paid: priceRobux > 0,
  };

  const seal = ticketSeal(ticket.id, ticket.code);
  const sealValid = input.seal
    ? input.seal.trim().toUpperCase() === seal
    : undefined;

  const base = {
    ticket: {
      id: ticket.id,
      code: ticket.code,
      status: ticket.status as "RESERVED" | "CHECKED_IN" | "CANCELLED",
      admission,
      activated: Boolean(ticket.activatedAt),
      activatedAt: ticket.activatedAt,
      checkedIn: ticket.status === "CHECKED_IN",
      checkedInAt: ticket.checkedInAt,
      seal,
      ...(sealValid === undefined ? {} : { sealValid }),
    },
    event: {
      id: ticket.event.id,
      slug: ticket.event.slug,
      title: ticket.event.title,
      startsAt: ticket.event.startsAt,
      doorsAt: ticket.event.doorsAt,
      venue: ticket.event.venue,
      partnerId: ticket.event.partnerId ?? null,
    },
    holder: {
      robloxId: ticket.user.robloxId,
      username: ticket.user.username,
      displayName: ticket.user.displayName,
    },
  };

  if (ticket.status === "CANCELLED") {
    return {
      ...base,
      valid: false,
      admit: false,
      reason: "cancelled",
      message: "This ticket was cancelled. Do not admit.",
    };
  }

  if (ticket.status === "CHECKED_IN") {
    return {
      ...base,
      valid: true,
      admit: false,
      reason: "already_checked_in",
      message: "Already checked in. Someone has used this ticket.",
    };
  }

  return {
    ...base,
    valid: true,
    admit: true,
    reason: "ok",
    message: `Admit — ${admission.tier}`,
  };
}

/**
 * Turn what somebody typed — "chrxs_dev", "@chrxs_dev", or an id — into a robloxId.
 *
 * A USERNAME IS NOT AN IDENTITY. A player can rename tomorrow, and the copy we
 * stored when they signed in is only true as of the day they signed in. So the
 * name is resolved against Roblox, which answers with the id, and the id is what
 * the ticket is actually looked up by. That id never changes, so a player who
 * renamed the night before the show still gets through their own door.
 *
 * Roblox is a third party and the door cannot stop when it has a bad minute, so a
 * failed call falls back to our own users table. That copy is the stale one, which
 * is why a name matching two accounts there is refused instead of guessed at: one
 * of the two is a rename we never saw, and admitting the wrong person on a coin
 * flip is worse than making the crew type the id.
 */
async function resolveHolderId(username: string): Promise<string | null> {
  const name = username.replace(/^@/, "").trim();
  if (!name) return null;

  // An id typed into the name field is already the answer.
  if (/^\d{1,20}$/.test(name)) return name;

  const profile = await resolveRobloxUser(name);
  if (profile) return profile.robloxId;

  const matches = await prisma.user.findMany({
    where: { username: { equals: name, mode: "insensitive" } },
    select: { robloxId: true },
    take: 2,
  });
  return matches.length === 1 ? matches[0].robloxId : null;
}

async function lookupByHolder(robloxId: string, eventId: string) {
  const user = await prisma.user.findUnique({ where: { robloxId } });
  if (!user) return null;
  return prisma.ticket.findUnique({
    where: { eventId_userId: { eventId, userId: user.id } },
    include: { event: true, user: true },
  });
}

/**
 * Check the ticket, and if it may be admitted, mark it CHECKED_IN.
 *
 * IDEMPOTENT, and it has to be: a scanner double-fires, a crew member taps twice,
 * a flaky connection retries. Redeeming an already-redeemed ticket does not error
 * and does not move `checkedInAt` — it comes back with admit:false and
 * reason:"already_checked_in", which is the door's cue to stop the second person.
 *
 * The write is conditional on the row still being RESERVED, so two simultaneous
 * scans of the same ticket cannot both win: the second matches zero rows, re-reads,
 * and reports the check-in the first one performed.
 */
export async function redeemTicket(
  input: LookupInput,
): Promise<VerifyResult | typeof BAD_REQUEST> {
  const result = await checkTicket(input);
  if (result === BAD_REQUEST || !result.ticket) return result;
  if (!result.admit) return result;

  const { count } = await prisma.ticket.updateMany({
    // The status guard IS the lock. Without it, two concurrent scans both pass
    // the check above and both write, and the door admits two people on one
    // ticket while both requests report success.
    where: { id: result.ticket.id, status: "RESERVED" },
    data: {
      status: "CHECKED_IN",
      checkedInAt: new Date(),
      // Presenting a ticket at the door IS activating it. Somebody who reserved,
      // never tapped Activate, and turned up with the code should not be turned
      // away over a ritual they skipped.
      ...(result.ticket.activated ? {} : { activatedAt: new Date() }),
    },
  });

  // Lost the race, or it changed under us. Re-read and report the truth rather
  // than the truth as it was a moment ago.
  if (count === 0) return checkTicket(input);

  const now = new Date();
  return {
    ...result,
    admit: true,
    reason: "ok",
    message: `Checked in — ${result.ticket.admission.tier}`,
    ticket: {
      ...result.ticket,
      status: "CHECKED_IN",
      checkedIn: true,
      checkedInAt: now,
      activated: true,
      activatedAt: result.ticket.activatedAt ?? now,
    },
  };
}

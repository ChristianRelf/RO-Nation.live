"use server";

import { revalidatePath } from "next/cache";
import { requireCompanyUser } from "@/lib/company";
import { partnerPortalRoute } from "@/lib/partners/urls";
import { requireScopeUser } from "@/lib/portal-scope";
import {
  AuditAction,
  AuditActorKind,
  AuditTarget,
  recordAudit,
  scopeFromPartnerId,
} from "@/lib/audit";
import {
  BAD_REQUEST,
  checkTicket,
  redeemTicket,
  type LookupInput,
  type VerifyResult,
} from "@/lib/tickets/verify";

// The manual door: a crew member typing a code into a laptop.
//
// It exists because the scanner will fail. The venue's wifi drops, the phone dies,
// the barcode is creased, somebody turns up with the code written on their hand -
// and the queue does not stop for any of that. This is the fallback that keeps the
// door moving, and it makes exactly the same decision the game API makes, because
// it calls the same function (lib/tickets/verify.ts).
//
// SCOPE is the whole security story here. The game key is one key for one
// deployment; a person is not. A partner's crew must be able to check THEIR
// tickets and no one else's, so every lookup below passes a scope the guard
// returned - never a scope the form sent.

export type DoorState =
  | { state: "idle" }
  | { state: "error"; message: string }
  | { state: "result"; result: Extract<VerifyResult, { ticket: object }> | Extract<VerifyResult, { ticket: null }> };

const err = (message: string): DoorState => ({ state: "error", message });

type DoorActor = { robloxId: string; displayName: string };

/**
 * Guard for the door: the scope it may look inside, and who is working it.
 *
 * Three doors, one function, and the scope id says which:
 *
 *   ""         /company/door, on the MAIN site. requireCompanyUser(), as always.
 *   "shasha"   /shasha/door, on the portal host. requireScopeUser() - so a
 *              read-only staffer can work it, which is the point below.
 *   "<slug>"   a partner's, unchanged.
 *
 * The two RNL doors look at exactly the same shows, because scope.eventScope is
 * NULL for SHASHA - the same NULL Event.partnerId uses for RNL's own. They are one
 * door with two entrances, not two doors that must be kept in step.
 *
 * Read-only STAFF may work any of them, deliberately: working the door IS the
 * read-only member's job, and refusing them here would mean the only people who
 * can admit anybody are the managers, who are usually running the show rather than
 * standing at the entrance. Redeeming is not editing the line-up.
 *
 * (SHASHA's door could not use requireCompanyUser() even though the rank numbers
 * match today: it redirects to /company/access on the MAIN site, which would bounce
 * a rank-200 staffer cross-host to a page they cannot open. requireScopeUser sends
 * them to /shasha/login, which is on the host they are already standing on.)
 */
async function authorise(
  scopeId: string,
): Promise<{ lookupScope: string | null; actor: DoorActor }> {
  if (!scopeId) {
    const user = await requireCompanyUser();
    return {
      lookupScope: null,
      actor: { robloxId: user.robloxId, displayName: user.displayName },
    };
  }

  const { scope, actor } = await requireScopeUser(scopeId);
  return { lookupScope: scope.eventScope, actor };
}

/**
 * What the crew typed, as a lookup - or the complaint to show them instead.
 *
 * Two ways in, because two things happen at a real door. Usually there is a code
 * to scan. Sometimes there is a person who lost it and all they have is their
 * name, so the door can ask by player instead - the same lookup the game API makes
 * when somebody joins the experience.
 *
 * A player lookup NEEDS a show pinned. One person can hold a ticket to every event
 * we run, so "has @x got a ticket" has no single answer until the door says which
 * night it is.
 */
function lookup(
  formData: FormData,
  scope: string | null,
): LookupInput | DoorState {
  const code = String(formData.get("code") || "").trim();
  const player = String(formData.get("player") || "").trim();
  const eventId = String(formData.get("eventId") || "").trim() || null;

  if (!code && !player) return err("Scan a ticket code, or enter a player.");
  if (!code && !eventId) {
    return err("Pick tonight's show to look a player up by name.");
  }

  return { code: code || null, username: player || null, eventId, scope };
}

const isComplaint = (v: LookupInput | DoorState): v is DoorState =>
  "state" in v;

/** Look, don't touch. */
export async function doorCheck(
  _prev: DoorState | null,
  formData: FormData,
): Promise<DoorState> {
  const scopeId = String(formData.get("scope") || "");
  const { lookupScope } = await authorise(scopeId);

  const input = lookup(formData, lookupScope);
  if (isComplaint(input)) return input;

  const result = await checkTicket(input);
  if (result === BAD_REQUEST) {
    return err("Scan a ticket code, or enter a player.");
  }

  return { state: "result", result };
}

/** Look, and burn it. */
export async function doorRedeem(
  _prev: DoorState | null,
  formData: FormData,
): Promise<DoorState> {
  const scopeId = String(formData.get("scope") || "");
  const { lookupScope, actor } = await authorise(scopeId);

  const input = lookup(formData, lookupScope);
  if (isComplaint(input)) return input;

  const result = await redeemTicket(input);
  if (result === BAD_REQUEST) {
    return err("Scan a ticket code, or enter a player.");
  }

  // `admit` is what says a check-in actually HAPPENED, and it is the only thing
  // that does. redeemTicket returns the unchanged result for a ticket that was
  // already checked in (admit: false), and re-reads rather than reporting success
  // when it loses the status race to a second scanner - so branching on
  // `result.ticket` alone would write an audit line every time somebody scanned
  // the same ticket twice, which is exactly the event the door exists to refuse.
  if (result.ticket && result.admit) {
    await recordAudit({
      // Scope follows the DATA: the show's own org, whichever door was used. A
      // check-in at /company/door and one at /shasha/door are the same act on the
      // same row and belong in the same history. See lib/audit.ts.
      scope: scopeFromPartnerId(result.event.partnerId),
      action: AuditAction.CHECKED_IN,
      target: AuditTarget.TICKET,
      targetId: result.ticket.id,
      targetName: result.ticket.code,
      actor: {
        id: actor.robloxId,
        name: actor.displayName,
        // The /company door is the one on the main site; every other is the portal.
        kind: scopeId ? AuditActorKind.PORTAL : AuditActorKind.COMPANY,
      },
      summary: `${actor.displayName} checked ${result.holder.username} in to ${result.event.title}`,
      meta: {
        eventId: result.event.id,
        tier: result.ticket.admission.tier,
        holderRobloxId: result.holder.robloxId,
      },
    });
  }

  // One more person through the door, so every list that counts them is stale.
  if (result.ticket) {
    if (lookupScope) {
      revalidatePath(partnerPortalRoute(lookupScope, "/studio/events"));
    } else {
      // RNL's shows are reachable from two places now, and a check-in changes the
      // count on both. Revalidating only the one the crew happened to use is how
      // somebody reloads the other and concludes the scanner is not working.
      revalidatePath(`/company/events/${result.event.id}/attendees`);
      revalidatePath("/shasha/shows");
    }
  }

  return { state: "result", result };
}

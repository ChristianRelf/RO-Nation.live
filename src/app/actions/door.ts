"use server";

import { revalidatePath } from "next/cache";
import { requireCompanyUser } from "@/lib/company";
import { requirePartnerUser } from "@/lib/partners/guard";
import { partnerPortalRoute } from "@/lib/partners/urls";
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

/**
 * Guard for the door, and the scope it may look inside.
 *
 * RNL staff at /company get RNL's shows. A partner's crew get theirs - including
 * read-only STAFF, deliberately: working the door IS the read-only member's job,
 * and refusing them here would mean the only people who can admit anybody are the
 * managers, who are usually the ones running the show rather than standing at the
 * entrance. Redeeming is not editing the line-up.
 */
async function authorise(slug?: string) {
  if (slug) {
    const { partner } = await requirePartnerUser(slug);
    return partner.slug;
  }
  await requireCompanyUser();
  return null;
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
  const slug = String(formData.get("scope") || "") || undefined;
  const scope = await authorise(slug);

  const input = lookup(formData, scope);
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
  const slug = String(formData.get("scope") || "") || undefined;
  const scope = await authorise(slug);

  const input = lookup(formData, scope);
  if (isComplaint(input)) return input;

  const result = await redeemTicket(input);
  if (result === BAD_REQUEST) {
    return err("Scan a ticket code, or enter a player.");
  }

  // The attendee list for this show now shows one more person through the door.
  if (result.ticket) {
    revalidatePath(
      scope
        ? partnerPortalRoute(scope, "/studio/events")
        : `/company/events/${result.event.id}/attendees`,
    );
  }

  return { state: "result", result };
}

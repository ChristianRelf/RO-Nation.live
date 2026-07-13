"use server";

import { revalidatePath } from "next/cache";
import { requireCompanyUser } from "@/lib/company";
import { requirePartnerUser } from "@/lib/partners/guard";
import { partnerPortalRoute } from "@/lib/partners/urls";
import {
  BAD_REQUEST,
  checkTicket,
  redeemTicket,
  type VerifyResult,
} from "@/lib/tickets/verify";

// The manual door: a crew member typing a code into a laptop.
//
// It exists because the scanner will fail. The venue's wifi drops, the phone dies,
// the barcode is creased, somebody turns up with the code written on their hand —
// and the queue does not stop for any of that. This is the fallback that keeps the
// door moving, and it makes exactly the same decision the game API makes, because
// it calls the same function (lib/tickets/verify.ts).
//
// SCOPE is the whole security story here. The game key is one key for one
// deployment; a person is not. A partner's crew must be able to check THEIR
// tickets and no one else's, so every lookup below passes a scope the guard
// returned — never a scope the form sent.

export type DoorState =
  | { state: "idle" }
  | { state: "error"; message: string }
  | { state: "result"; result: Extract<VerifyResult, { ticket: object }> | Extract<VerifyResult, { ticket: null }> };

const err = (message: string): DoorState => ({ state: "error", message });

/**
 * Guard for the door, and the scope it may look inside.
 *
 * RNL staff at /company get RNL's shows. A partner's crew get theirs — including
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

/** Look, don't touch. */
export async function doorCheck(
  _prev: DoorState | null,
  formData: FormData,
): Promise<DoorState> {
  const slug = String(formData.get("scope") || "") || undefined;
  const scope = await authorise(slug);

  const code = String(formData.get("code") || "").trim();
  const eventId = String(formData.get("eventId") || "").trim() || null;
  if (!code) return err("Type or scan a ticket code.");

  const result = await checkTicket({ code, eventId, scope });
  if (result === BAD_REQUEST) return err("Type or scan a ticket code.");

  return { state: "result", result };
}

/** Look, and burn it. */
export async function doorRedeem(
  _prev: DoorState | null,
  formData: FormData,
): Promise<DoorState> {
  const slug = String(formData.get("scope") || "") || undefined;
  const scope = await authorise(slug);

  const code = String(formData.get("code") || "").trim();
  const eventId = String(formData.get("eventId") || "").trim() || null;
  if (!code) return err("Type or scan a ticket code.");

  const result = await redeemTicket({ code, eventId, scope });
  if (result === BAD_REQUEST) return err("Type or scan a ticket code.");

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

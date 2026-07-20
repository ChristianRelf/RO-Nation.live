"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCompanyUser } from "@/lib/company";
import { requirePartnerManager } from "@/lib/partners/guard";
import { partnerPortalPath, partnerPortalRoute } from "@/lib/partners/urls";
import {
  cloneTemplateOnto,
  createVenueMap,
  readVenueForm,
  saveVenueLayout,
} from "@/lib/venue/form";
import { presetLayout } from "@/lib/venue/presets";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  AuditAction,
  AuditActorKind,
  AuditTarget,
  recordAudit,
  scopeFromPartnerId,
} from "@/lib/audit";

// Venue maps, for RNL and for every partner.
//
// TWO exports per operation, one guard each, one lib underneath - and that is deliberate.
// It is the rule components/roblox-picker.tsx states plainly: NOBODY BORROWS ANYBODY
// ELSE'S PERMISSION. A single `saveVenue(scope)` taking the scope from the form would mean
// the caller's authority is decided by a string the caller sent, which is not authority at
// all.
//
// So: requireCompanyUser() for RNL's, requirePartnerManager(slug) for a partner's, and the
// scope each one passes to the lib is the scope its own guard just proved.

const s = (form: FormData, key: string) => String(form.get(key) || "");

/**
 * One audit line for a venue write.
 *
 * `scope` here is the partnerId the guard proved - null for RNL - so it goes
 * through scopeFromPartnerId() like every other non-roster table. The pairs of
 * exports above deliberately do not share a guard; they can share this, because it
 * takes the already-proven scope rather than reading one.
 */
/**
 * A venue map's name, for the audit line.
 *
 * It lives on the VenueMap row, not in the layout JSON the form posts - the layout
 * is geometry, and the name is what a person calls the room. Scoped, so an id from
 * another org names nothing rather than leaking a title.
 */
async function venueName(id: string, scope: string | null) {
  const map = await prisma.venueMap.findFirst({
    where: { id, partnerId: scope },
    select: { name: true },
  });
  return map?.name ?? "a venue";
}

function logVenue(
  scope: string | null,
  actor: { robloxId: string; username: string },
  input: {
    action: AuditAction;
    targetId?: string;
    targetName: string;
    did: string;
    meta?: Prisma.InputJsonValue;
  },
) {
  return recordAudit({
    scope: scopeFromPartnerId(scope),
    action: input.action,
    target: AuditTarget.VENUE_MAP,
    targetId: input.targetId,
    targetName: input.targetName,
    actor: {
      id: actor.robloxId,
      name: actor.username,
      kind: scope ? AuditActorKind.PORTAL : AuditActorKind.COMPANY,
    },
    summary: `${actor.username} ${input.did}`,
    meta: input.meta,
  });
}

// ---- RNL's own -------------------------------------------------------------

export async function saveCompanyVenue(formData: FormData) {
  const user = await requireCompanyUser();

  const id = s(formData, "id");
  const layout = readVenueForm(formData);

  // NULL is "I could not read the form", and it is NOT an empty venue. Saving an empty
  // layout over a sold seated show would delete every section in it and put the whole room
  // back on sale over the top of the people already sitting in it. Refuse. See
  // readVenueForm().
  if (!id || !layout) redirect(`/company/venues/${id}/edit?error=unreadable`);

  const result = await saveVenueLayout({
    id,
    scope: null,
    layout,
    actorName: user.username,
  });

  if (!result.ok) {
    const keys = result.reason === "sold_seats" ? result.keys.join(",") : "";
    redirect(
      `/company/venues/${id}/edit?error=${result.reason}${keys ? `&keys=${encodeURIComponent(keys)}` : ""}`,
    );
  }

  const savedName = await venueName(id, null);
  await logVenue(null, user, {
    action: AuditAction.UPDATED,
    targetId: id,
    targetName: savedName,
    did: `edited the venue "${savedName}"`,
  });

  revalidatePath("/company/venues");
  revalidatePath(`/company/venues/${id}/edit`);
  redirect("/company/venues");
}

export async function createCompanyVenue(formData: FormData) {
  const user = await requireCompanyUser();

  const name = s(formData, "name").trim();
  if (!name) redirect("/company/venues/new?error=required");

  // A preset id, resolved to a room server-side - never geometry from the form. An unknown
  // id (or none) is `undefined`, and createVenueMap starts you on an empty canvas.
  const preset = presetLayout(s(formData, "preset")) ?? undefined;

  const map = await createVenueMap({
    scope: null,
    name,
    layout: preset,
    actorId: user.robloxId,
    actorName: user.username,
  });

  await logVenue(null, user, {
    action: AuditAction.CREATED,
    targetId: map.id,
    targetName: name,
    did: `created the venue "${name}"`,
  });

  revalidatePath("/company/venues");
  redirect(`/company/venues/${map.id}/edit`);
}

export async function attachCompanyVenue(formData: FormData) {
  const user = await requireCompanyUser();

  const eventId = s(formData, "eventId");
  const templateId = s(formData, "templateId");
  if (!eventId || !templateId) redirect(`/company/events/${eventId}/edit?error=required`);

  const result = await cloneTemplateOnto({
    eventId,
    templateId,
    scope: null,
    actorId: user.robloxId,
    actorName: user.username,
  });

  // Only on success. cloneTemplateOnto refuses a template that is not this org's,
  // and a line saying a room was attached when it was not is worse than silence.
  if (result.ok) {
    await logVenue(null, user, {
      action: AuditAction.UPDATED,
      targetId: eventId,
      targetName: "seating",
      did: "attached a venue map to a show",
      meta: { eventId, templateId },
    });
  }

  revalidatePath(`/company/events/${eventId}/edit`);
  redirect(
    result.ok
      ? `/company/events/${eventId}/venue`
      : `/company/events/${eventId}/edit?error=venue`,
  );
}

// ---- A partner's -----------------------------------------------------------

export async function savePartnerVenue(formData: FormData) {
  const scope = s(formData, "scope");
  // PartnerUser IS the session, with the partner hung off it - not a wrapper around one.
  const user = await requirePartnerManager(scope);
  const partner = user.partner;

  const id = s(formData, "id");
  const layout = readVenueForm(formData);

  const base = partnerPortalPath(partner.slug, "/studio/venues");
  if (!id || !layout) redirect(`${base}/${id}/edit?error=unreadable`);

  const result = await saveVenueLayout({
    id,
    // The scope the guard just PROVED - not the one the form asked for.
    scope: partner.slug,
    layout,
    actorName: user.username,
  });

  if (!result.ok) {
    const keys = result.reason === "sold_seats" ? result.keys.join(",") : "";
    redirect(
      `${base}/${id}/edit?error=${result.reason}${keys ? `&keys=${encodeURIComponent(keys)}` : ""}`,
    );
  }

  // revalidatePath takes the INTERNAL route (/pp/<slug>/…), never the public one the
  // browser is on. `base` is the public path and is right for the redirect below - hand it
  // to revalidatePath instead and it matches no route, throws nothing, and the venue list
  // simply keeps serving the layout you just replaced. See lib/partners/urls.ts.
  const savedName = await venueName(id, partner.slug);
  await logVenue(partner.slug, user, {
    action: AuditAction.UPDATED,
    targetId: id,
    targetName: savedName,
    did: `edited the venue "${savedName}"`,
  });

  revalidatePath(partnerPortalRoute(partner.slug, "/studio/venues"));
  revalidatePath(partnerPortalRoute(partner.slug, `/studio/venues/${id}/edit`));
  redirect(base);
}

export async function createPartnerVenue(formData: FormData) {
  const scope = s(formData, "scope");
  const user = await requirePartnerManager(scope);
  const partner = user.partner;

  const name = s(formData, "name").trim();
  const base = partnerPortalPath(partner.slug, "/studio/venues");
  if (!name) redirect(`${base}/new?error=required`);

  // A preset id, resolved server-side; see the note on createCompanyVenue.
  const preset = presetLayout(s(formData, "preset")) ?? undefined;

  const map = await createVenueMap({
    scope: partner.slug,
    name,
    layout: preset,
    actorId: user.robloxId,
    actorName: user.username,
  });

  await logVenue(partner.slug, user, {
    action: AuditAction.CREATED,
    targetId: map.id,
    targetName: name,
    did: `created the venue "${name}"`,
  });

  revalidatePath(partnerPortalRoute(partner.slug, "/studio/venues"));
  redirect(`${base}/${map.id}/edit`);
}

export async function attachPartnerVenue(formData: FormData) {
  const scope = s(formData, "scope");
  const user = await requirePartnerManager(scope);
  const partner = user.partner;

  const eventId = s(formData, "eventId");
  const templateId = s(formData, "templateId");
  const base = partnerPortalPath(partner.slug, "/studio/events");

  if (!eventId || !templateId) redirect(`${base}/${eventId}/edit?error=required`);

  const result = await cloneTemplateOnto({
    eventId,
    templateId,
    scope: partner.slug,
    actorId: user.robloxId,
    actorName: user.username,
  });

  if (result.ok) {
    await logVenue(partner.slug, user, {
      action: AuditAction.UPDATED,
      targetId: eventId,
      targetName: "seating",
      did: "attached a venue map to a show",
      meta: { eventId, templateId },
    });
  }

  revalidatePath(partnerPortalRoute(partner.slug, `/studio/events/${eventId}/edit`));
  revalidatePath(partnerPortalRoute(partner.slug, `/studio/events/${eventId}/venue`));
  redirect(
    result.ok ? `${base}/${eventId}/venue` : `${base}/${eventId}/edit?error=venue`,
  );
}

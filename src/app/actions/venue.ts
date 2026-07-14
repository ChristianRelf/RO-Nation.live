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

  revalidatePath("/company/venues");
  revalidatePath(`/company/venues/${id}/edit`);
  redirect("/company/venues");
}

export async function createCompanyVenue(formData: FormData) {
  const user = await requireCompanyUser();

  const name = s(formData, "name").trim();
  if (!name) redirect("/company/venues/new?error=required");

  const map = await createVenueMap({
    scope: null,
    name,
    actorId: user.robloxId,
    actorName: user.username,
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

  const map = await createVenueMap({
    scope: partner.slug,
    name,
    actorId: user.robloxId,
    actorName: user.username,
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

  revalidatePath(partnerPortalRoute(partner.slug, `/studio/events/${eventId}/edit`));
  revalidatePath(partnerPortalRoute(partner.slug, `/studio/events/${eventId}/venue`));
  redirect(
    result.ok ? `${base}/${eventId}/venue` : `${base}/${eventId}/edit?error=venue`,
  );
}

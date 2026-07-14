"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { readEventForm, s, uniqueSlug } from "@/lib/content";
import {
  assertPartnerFeature,
  requirePartnerManager,
} from "@/lib/partners/guard";
import {
  partnerPortalPath,
  partnerPortalRoute,
  partnerSiteRoute,
} from "@/lib/partners/urls";
import { readTiersForm, syncEventTiers } from "@/lib/tickets/tiers-form";

// A partner's own shows.
//
// /company is RNL's tool, and it is pinned to RNL's events (partnerId: null) -
// so without this file, a partner's shows would exist in the database with nobody
// able to edit them. This is the other half of that boundary: the partner's crew
// manages their own line-up, and only theirs.
//
// The scope comes in on the form body, exactly as it does for the roster
// actions, and is safe for exactly the same reason: nothing is authorized from
// it. requirePartnerManager() re-reads the caller's grant on that partner from
// the database, so a forged scope fails a different org's guard rather than
// passing this one. And every write matches on { id, partnerId } together, so a
// manager of one partner cannot reach another's show by pasting its id.

function refresh(slug: string) {
  // The studio list (internal route), and the public pages the change is now
  // visible on. All internal - revalidatePath does not know about the pretty
  // hostnames. See lib/partners/urls.ts.
  revalidatePath(partnerPortalRoute(slug, "/studio/events"));
  revalidatePath(partnerSiteRoute(slug));
  revalidatePath(partnerSiteRoute(slug, "/events"));
}

export async function createPartnerEvent(formData: FormData) {
  const scope = s(formData, "scope");
  const { partner } = await requirePartnerManager(scope);
  // Guarded on the action too, not just the page. The page is where a person is
  // stopped; this is where a POST is.
  assertPartnerFeature(partner, "events");

  const data = readEventForm(formData);
  const tiers = readTiersForm(formData);
  const base = partnerPortalPath(partner.slug, "/studio/events");

  if (!data.title || !data.startsAt || !data.description) {
    redirect(`${base}/new?error=required`);
  }
  if (tiers === null) redirect(`${base}/new?error=tiers`);

  // Event slugs stay globally unique: /events/<slug> and the ticket code are
  // shared across every org. Posts and careers are scoped per partner.
  const slug = await uniqueSlug(data.title, "event");
  const event = await prisma.event.create({
    data: {
      ...data,
      startsAt: data.startsAt!,
      slug,
      // The whole point. An event created here belongs to the partner, and that
      // is what keeps it off RNL's site and out of RNL's tools.
      partnerId: partner.slug,
    },
  });
  // A game pass id already on another tier - see syncEventTiers. The show saved; its
  // tiers did not (the sync rolls back whole), so send them to the editor to fix it.
  const synced = await syncEventTiers(event.id, tiers);
  if (!synced.ok) {
    refresh(partner.slug);
    redirect(`${base}/${event.id}/edit?error=${synced.reason}`);
  }

  refresh(partner.slug);
  redirect(base);
}

export async function updatePartnerEvent(formData: FormData) {
  const scope = s(formData, "scope");
  const { partner } = await requirePartnerManager(scope);
  assertPartnerFeature(partner, "events");

  const id = s(formData, "id");
  const data = readEventForm(formData);
  const tiers = readTiersForm(formData);
  const base = partnerPortalPath(partner.slug, "/studio/events");

  if (!id || !data.title || !data.startsAt || !data.description) {
    redirect(`${base}/${id}/edit?error=required`);
  }
  if (tiers === null) redirect(`${base}/${id}/edit?error=tiers`);

  // updateMany, matched on the partner too: an id belonging to RNL or to another
  // partner matches zero rows rather than being quietly overwritten.
  const { count } = await prisma.event.updateMany({
    where: { id, partnerId: partner.slug },
    data: { ...data, startsAt: data.startsAt! },
  });
  // And the tiers go through the same gate. syncEventTiers matches on eventId
  // alone, so gating it on the row the event write actually matched is what stops
  // one partner reaching another's tiers by pasting their event id.
  if (count > 0) {
    const synced = await syncEventTiers(id, tiers);
    if (!synced.ok) {
      refresh(partner.slug);
      redirect(`${base}/${id}/edit?error=${synced.reason}`);
    }
  }

  refresh(partner.slug);
  redirect(base);
}

export async function deletePartnerEvent(formData: FormData) {
  const scope = s(formData, "scope");
  const { partner } = await requirePartnerManager(scope);
  assertPartnerFeature(partner, "events");

  const id = s(formData, "id");
  if (id) {
    await prisma.event.deleteMany({
      where: { id, partnerId: partner.slug },
    });
  }

  refresh(partner.slug);
  redirect(partnerPortalPath(partner.slug, "/studio/events"));
}

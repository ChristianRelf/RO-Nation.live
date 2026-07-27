"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { readEventForm, s, uniqueSlug } from "@/lib/content";
import { requireCompanyUser } from "@/lib/company";
import { assertPartnerFeature } from "@/lib/partners/guard";
import { partnerBySlug } from "@/lib/partners/registry";
import { partnerPortalRoute, partnerSiteRoute } from "@/lib/partners/urls";
import { requireScopeManager, SHASHA_SCOPE } from "@/lib/portal-scope";
import { readTiersForm, syncEventTiers } from "@/lib/tickets/tiers-form";
import {
  cancelledNotice,
  diffEventChange,
  notifyEventAudience,
} from "@/lib/member-notify";
import { announceShow } from "@/lib/announce";
import {
  AuditAction,
  AuditActorKind,
  AuditTarget,
  recordAudit,
  scopeFromPartnerId,
} from "@/lib/audit";

// Creating, editing and cancelling a show - for RNL and for every partner.
//
// ---- This file is a MERGE, not a new abstraction ---------------------------
//
// There were two of these. actions/partner-events.ts and the events section of
// actions/company.ts were the same 100 lines twice: same readEventForm, same
// uniqueSlug, same syncEventTiers, same diffEventChange, same
// notifyEventAudience, same await-the-notice-BEFORE-the-delete ordering. They
// differed in four things and nothing else:
//
//   guard          requireCompanyUser() vs requirePartnerManager(slug)
//   partnerId      null                 vs partner.slug
//   redirect base  /company/events      vs /<slug>/studio/events
//   revalidate     RNL's paths          vs the partner's
//
// RosterScope already resolves three of those four (basePath, routeBase and -
// since the portal grew a studio for SHASHA - eventScope). So this is one
// implementation parameterised by the thing that was always the parameter, and
// the duplicate is deleted rather than left to drift. A bug fixed in a show's
// cancellation notice is now fixed for everybody, which was the whole argument
// for lib/portal-scope.ts in the first place.
//
// ---- SECURITY: the scope is on the form body, and authorises nothing --------
//
// Same contract as actions/portal.ts and actions/partner-members.ts. The scope
// only selects WHICH guard runs; the guard re-reads the caller's standing in that
// org from the database. Posting scope=sleeptokenro from an RNL session does not
// grant anything - it fails Sleep Token's guard instead of RNL's.
//
// And passing a guard is still not enough on its own: every write below matches
// on { id, partnerId } together via the *Many form, so an id belonging to another
// org affects zero rows rather than being quietly overwritten. Ids are opaque.
// Opaque is not secret.

/** Where a scope's studio lives, and which partnerId its rows carry. */
type EventDoor = {
  /** The audit/portal scope id: "shasha" or a partner slug. */
  scopeId: string;
  /** The `partnerId` column value. NULL for RNL - see RosterScope.eventScope. */
  partnerId: string | null;
  /** Public path of the show list to redirect back to. */
  base: string;
  actor: { robloxId: string; displayName: string };
  actorKind: AuditActorKind;
};

/**
 * Guard, and where the caller came from.
 *
 * Three doors onto the same rows, exactly as actions/door.ts has three doors onto
 * the same tickets:
 *
 *   ""         /company/events on the MAIN site. requireCompanyUser() - rank in
 *              RNL's group, unchanged from before this file existed.
 *   "shasha"   /shasha/studio on the portal host. requireScopeManager(), which is
 *              that rank OR an explicit SHASHA grant (lib/shasha.ts).
 *   "<slug>"   a partner's studio, unchanged.
 *
 * The two RNL doors write the SAME rows - partnerId NULL either way - and that is
 * the point of the parity work. They are deliberately not the same GUARD, though:
 * COMPANY_MIN_RANK and SHASHA_MANAGER_RANK both default to 245 and are separate
 * settings, and /company has never accepted a grant in place of a rank. Widening
 * it silently, as a side effect of sharing an implementation, would be a change
 * nobody asked for hidden inside a refactor.
 */
async function authorise(scopeId: string): Promise<EventDoor> {
  if (!scopeId) {
    const user = await requireCompanyUser();
    return {
      scopeId: SHASHA_SCOPE,
      partnerId: null,
      base: "/company/events",
      actor: { robloxId: user.robloxId, displayName: user.displayName },
      actorKind: AuditActorKind.COMPANY,
    };
  }

  const { scope, actor } = await requireScopeManager(scopeId);

  if (scope.id === SHASHA_SCOPE) {
    return {
      scopeId: scope.id,
      partnerId: scope.eventScope, // null - RNL's own
      // /shasha/shows, not /shasha/studio/events. A partner's studio holds their
      // shows, blog, careers and homepage copy, so it earns a section of its own;
      // RNL authors all of that in /company and brings only the line-up onto the
      // portal, next to the door that needs it. One section does not need a studio
      // wrapped around it.
      base: `${scope.basePath}/shows`,
      actor,
      actorKind: AuditActorKind.PORTAL,
    };
  }

  // Guarded on the ACTION, not just on the page. The page is where a person is
  // stopped; this is where a POST is.
  const partner = partnerBySlug(scope.id);
  if (!partner) redirect("/hub");
  assertPartnerFeature(partner, "events");

  return {
    scopeId: scope.id,
    partnerId: scope.eventScope,
    base: `${scope.basePath}/studio/events`,
    actor,
    actorKind: AuditActorKind.PORTAL,
  };
}

/**
 * Everything a saved show could have changed.
 *
 * revalidatePath takes INTERNAL routes - a partner's pages render at /pp/<slug>/…,
 * so revalidating the pretty path matches no route, throws nothing, and quietly
 * serves stale. See lib/partners/urls.ts.
 */
function refresh(door: EventDoor) {
  if (door.partnerId) {
    revalidatePath(partnerPortalRoute(door.partnerId, "/studio/events"));
    revalidatePath(partnerSiteRoute(door.partnerId));
    revalidatePath(partnerSiteRoute(door.partnerId, "/events"));
    return;
  }

  // RNL's own show, reachable from BOTH of its doors - so both are revalidated
  // however the edit arrived. Miss the other one and a manager who edits in the
  // studio sees the old title on /company/events and reasonably concludes the
  // save did not work.
  revalidatePath("/company/events");
  revalidatePath("/shasha/studio/events");
  revalidatePath("/events");
  revalidatePath("/");
}

export async function createStudioEvent(formData: FormData) {
  const door = await authorise(s(formData, "scope"));

  const data = readEventForm(formData);
  const tiers = readTiersForm(formData);

  if (!data.title || !data.startsAt || !data.description) {
    redirect(`${door.base}/new?error=required`);
  }
  if (tiers === null) redirect(`${door.base}/new?error=tiers`);

  // Event slugs stay globally unique: /events/<slug> and the ticket code are
  // shared across every org. Posts and careers are scoped per partner.
  const slug = await uniqueSlug(data.title, "event");
  const event = await prisma.event.create({
    data: {
      ...data,
      startsAt: data.startsAt!,
      slug,
      // The whole point. A show created here belongs to this org, and that is
      // what keeps a partner's off RNL's site and out of RNL's tools.
      partnerId: door.partnerId,
    },
  });

  await recordAudit({
    scope: scopeFromPartnerId(door.partnerId),
    action: AuditAction.CREATED,
    target: AuditTarget.EVENT,
    targetId: event.id,
    targetName: event.title,
    actor: { ...ids(door), kind: door.actorKind },
    summary: `${door.actor.displayName} created ${event.title}`,
    meta: { status: event.status, startsAt: event.startsAt.toISOString() },
  });

  // Straight to PUBLISHED - the show is live the moment this row landed, so it is
  // posted to Discord. Created as a DRAFT it is announced later, by the publish
  // branch in updateStudioEvent; either way the announcement fires exactly once,
  // on the transition into PUBLISHED.
  //
  // Fire-and-forget, before the tier sync that may redirect: announceShow() never
  // throws and is never awaited, so Discord cannot delay - or fail - a save.
  if (event.status === "PUBLISHED") void announceShow(event);

  // A game pass id already on another tier - see syncEventTiers. The show saved;
  // its tiers did not (the sync rolls back whole), so send them to the editor to
  // fix it rather than to a list wondering where their VIP tier went.
  const synced = await syncEventTiers(event.id, tiers);
  if (!synced.ok) {
    refresh(door);
    redirect(`${door.base}/${event.id}/edit?error=${synced.reason}`);
  }

  refresh(door);
  redirect(door.base);
}

export async function updateStudioEvent(formData: FormData) {
  const door = await authorise(s(formData, "scope"));

  const id = s(formData, "id");
  const data = readEventForm(formData);
  const tiers = readTiersForm(formData);

  if (!id || !data.title || !data.startsAt || !data.description) {
    redirect(`${door.base}/${id}/edit?error=required`);
  }
  if (tiers === null) redirect(`${door.base}/${id}/edit?error=tiers`);

  // The row as it was, read before the write, so a material change (a new time, a
  // pulled show) can be diffed and the ticket-holders told.
  const before = await prisma.event.findFirst({
    where: { id, partnerId: door.partnerId },
  });

  // updateMany, matched on the org too: an id belonging to somebody else matches
  // zero rows rather than being quietly overwritten.
  const { count } = await prisma.event.updateMany({
    where: { id, partnerId: door.partnerId },
    data: { ...data, startsAt: data.startsAt! },
  });

  if (count > 0 && before) {
    // Publishing is the edit worth naming as itself - it is the moment a show
    // becomes real to the public. One expression, read twice below: the audit
    // line calls it PUBLISHED and Discord gets told, and those two must never be
    // able to disagree about what "posted" meant.
    //
    // The `before.status !== "PUBLISHED"` half is the entire anti-spam rule. Save
    // a live show forty times - a moved door time, a fixed typo - and this is
    // false every time, so the channel hears about it once. Un-publishing and
    // re-publishing announces again, which is correct: to anybody reading, that
    // is a show going up.
    const justPublished =
      before.status !== "PUBLISHED" && data.status === "PUBLISHED";

    // Fire-and-forget a change-notice to everyone holding or following this show.
    // Started before the tier sync that may redirect, so a saved edit always
    // notifies. Never throws (see member-notify.ts), so it cannot break the write.
    const notice = diffEventChange(before, data);
    if (notice) {
      void notifyEventAudience(
        { id, slug: before.slug, partnerId: door.partnerId },
        notice,
      );
    }

    // Same contract as the notice above: never awaited, never throws. The row is
    // already written by this point, so the show is live whatever Discord does.
    if (justPublished) {
      void announceShow({
        ...data,
        // The slug is not on the form - it is minted once, at creation, and never
        // edited. `before` is where the row's own identity lives.
        slug: before.slug,
        startsAt: data.startsAt!,
        partnerId: door.partnerId,
      });
    }

    await recordAudit({
      scope: scopeFromPartnerId(door.partnerId),
      action: justPublished
        ? AuditAction.PUBLISHED
        : before.status !== "ARCHIVED" && data.status === "ARCHIVED"
          ? AuditAction.ARCHIVED
          : AuditAction.UPDATED,
      target: AuditTarget.EVENT,
      targetId: id,
      targetName: data.title,
      actor: { ...ids(door), kind: door.actorKind },
      summary: `${door.actor.displayName} updated ${data.title}`,
      meta: {
        before: { status: before.status, startsAt: before.startsAt.toISOString() },
        after: { status: data.status, startsAt: data.startsAt!.toISOString() },
      },
    });
  }

  // The tiers go through the same gate. syncEventTiers matches on eventId alone,
  // so gating it on the row the event write actually matched is what stops one org
  // reaching another's tiers by pasting their event id.
  if (count > 0) {
    const synced = await syncEventTiers(id, tiers);
    if (!synced.ok) {
      refresh(door);
      redirect(`${door.base}/${id}/edit?error=${synced.reason}`);
    }
  }

  refresh(door);
  redirect(door.base);
}

export async function deleteStudioEvent(formData: FormData) {
  const door = await authorise(s(formData, "scope"));

  const id = s(formData, "id");
  if (id) {
    // Gather the audience and raise the cancellation notice BEFORE the delete -
    // the tickets and follows that define it cascade away with the event. This is
    // the one notifyEventAudience call that is awaited, for exactly that reason.
    const event = await prisma.event.findFirst({
      where: { id, partnerId: door.partnerId },
    });
    if (event) {
      await notifyEventAudience(
        { id: event.id, slug: event.slug, partnerId: door.partnerId },
        cancelledNotice(event.title),
        { deleted: true },
      );
      const { count } = await prisma.event.deleteMany({
        where: { id, partnerId: door.partnerId },
      });

      if (count > 0) {
        await recordAudit({
          scope: scopeFromPartnerId(door.partnerId),
          action: AuditAction.DELETED,
          target: AuditTarget.EVENT,
          targetId: event.id,
          targetName: event.title,
          actor: { ...ids(door), kind: door.actorKind },
          summary: `${door.actor.displayName} cancelled ${event.title}`,
          // The row is gone; this line is now the only record of what it was.
          meta: {
            slug: event.slug,
            startsAt: event.startsAt.toISOString(),
            venue: event.venue,
          },
        });
      }
    }
  }

  refresh(door);
  redirect(door.base);
}

const ids = (door: EventDoor) => ({
  id: door.actor.robloxId,
  name: door.actor.displayName,
});

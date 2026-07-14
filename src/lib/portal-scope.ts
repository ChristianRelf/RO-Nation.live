import "server-only";
import { notFound, redirect } from "next/navigation";
import { activePartners, partnerBySlug } from "./partners/registry";
import { partnerPortalPath, partnerPortalRoute } from "./partners/urls";
import { getPartnerAccess } from "./partners/guard";
import { getPortalAccess } from "./shasha";

// The VIP list and the blacklist are the same tool pointed at a different org.
//
// SHASHA is RNL's own copy; every partner gets theirs. They are one set of
// pages, one set of server actions and one set of components, over rows
// discriminated by `partnerId` - so a fix to the roster is a fix everywhere,
// rather than a fix that has to be remembered in n places.
//
// The two differ in exactly two ways, and this module is where both are
// resolved so that nothing downstream has to care:
//
//   who may write   SHASHA ranks off RNL's Roblox group (lib/shasha.ts).
//                   A partner's own people hold explicit grants - RNL does not
//                   own their group, so it cannot rank off it - while RNL staff
//                   ranked PARTNER_STAFF_RANK+ get in on the override. Both are
//                   resolved inside partners/guard.ts, so nothing here changes.
//
//   where it lives  /shasha/vip, vs /sleeptokenro/vip.
//
// Everything else - the queries, the audit trail, the forms - is shared.

/**
 * RNL's own list. Safe as a sentinel `partnerId` because the registry's
 * RESERVED set already forbids any partner from taking the "shasha" slug, so
 * this value can never collide with a real one.
 */
export const SHASHA_SCOPE = "shasha";

export type RosterScope = {
  /** The `partnerId` column value. Every roster query filters on this. */
  id: string;
  /** The org's name, for page copy. */
  name: string;
  /** Public path on the portal host - for <Link> and redirect(). */
  basePath: string;
  /** Internal path Next renders at - for revalidatePath(). See partners/urls.ts. */
  routeBase: string;
};

export type ScopedActor = {
  scope: RosterScope;
  actor: { robloxId: string; displayName: string };
  canWrite: boolean;
};

/** The scope for a portal id, or null if it names no portal at all. */
export function rosterScope(id: string): RosterScope | null {
  if (id === SHASHA_SCOPE) {
    return {
      id: SHASHA_SCOPE,
      name: "SHASHA",
      // SHASHA is not rewritten - the portal host serves /shasha directly - so
      // its public and internal paths are the same string. A partner's are not.
      basePath: "/shasha",
      routeBase: "/shasha",
    };
  }

  const partner = partnerBySlug(id);
  if (!partner) return null;

  return {
    id: partner.slug,
    name: partner.name,
    basePath: partnerPortalPath(partner.slug),
    routeBase: partnerPortalRoute(partner.slug),
  };
}

/**
 * Resolve the scope, and the caller's rights within it.
 *
 * Redirects to the right login page when signed out, and 404s when `id` names
 * no portal - so a caller cannot tell "no such partner" from "not your
 * partner", and cannot probe the registry by guessing slugs.
 *
 * Guarded PAGES must call this themselves before reading data, not lean on a
 * layout - see the note on requirePartnerUser() for why a layout guard still
 * ships the page's payload.
 */
export async function requireScopeUser(id: string): Promise<ScopedActor> {
  const scope = rosterScope(id);
  if (!scope) notFound();

  if (scope.id === SHASHA_SCOPE) {
    const access = await getPortalAccess();
    if (access.state !== "allowed") redirect("/shasha/login");
    return {
      scope,
      actor: {
        robloxId: access.user.robloxId,
        displayName: access.user.displayName,
      },
      canWrite: access.user.canWrite,
    };
  }

  const access = await getPartnerAccess(scope.id);
  if (!access || access.state !== "allowed") {
    redirect(`${scope.basePath}/login`);
  }
  return {
    scope,
    actor: {
      robloxId: access.user.robloxId,
      displayName: access.user.displayName,
    },
    canWrite: access.user.canWrite,
  };
}

/** The write tier. Read-only staff are bounced to the overview with a notice. */
export async function requireScopeManager(id: string): Promise<ScopedActor> {
  const scoped = await requireScopeUser(id);
  if (!scoped.canWrite) redirect(`${scoped.scope.basePath}?error=readonly`);
  return scoped;
}

// ------------------------------------------------------------------
// "Which portals can this person open at all?"
//
// The two above answer it for ONE portal, named by the URL. The docs ask it the
// other way round - they belong to nobody in particular, and you may read them
// if you have a door anywhere: SHASHA staff, or a partner's crew. That question
// lives here rather than in docs-guard.ts because it is about portals, and
// because docs-guard's own "who can mint a key" list is the same walk with a
// canWrite filter on the end. One loop, two tiers, no chance of them drifting.
// ------------------------------------------------------------------

/** A portal this person may open, and what they may do once inside it. */
export type ScopeGrant = {
  scope: RosterScope;
  canWrite: boolean;
};

/**
 * Every portal the caller may READ - read-only staff included. Does not redirect:
 * an empty list is a fact for the caller to act on, not an error.
 *
 * Sequential rather than parallel, which is fine: the partner list is short, and
 * every rank lookup behind it hits the same five-minute cache (lib/roblox-group).
 */
export async function readableScopes(): Promise<ScopeGrant[]> {
  const grants: ScopeGrant[] = [];

  const shasha = await getPortalAccess();
  if (shasha.state === "allowed") {
    // Non-null: SHASHA_SCOPE is the sentinel rosterScope() answers to first.
    grants.push({
      scope: rosterScope(SHASHA_SCOPE)!,
      canWrite: shasha.user.canWrite,
    });
  }

  for (const partner of activePartners()) {
    const access = await getPartnerAccess(partner.slug);
    if (access?.state === "allowed") {
      grants.push({
        scope: rosterScope(partner.slug)!,
        canWrite: access.user.canWrite,
      });
    }
  }

  return grants;
}

/**
 * The same question, answered as cheaply as it can be: does this person hold ANY
 * door at all?
 *
 * Short-circuits on the first grant, which readableScopes() cannot - and that
 * matters, because app/files/[id] calls this on every request for every byte a
 * PDF viewer asks for, and walking the whole partner list each time would put a
 * rank lookup in the path of a download.
 */
export async function hasAnyScope(): Promise<boolean> {
  const shasha = await getPortalAccess();
  if (shasha.state === "allowed") return true;

  for (const partner of activePartners()) {
    const access = await getPartnerAccess(partner.slug);
    if (access?.state === "allowed") return true;
  }

  return false;
}

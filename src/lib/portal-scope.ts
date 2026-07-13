import "server-only";
import { notFound, redirect } from "next/navigation";
import { partnerBySlug } from "./partners/registry";
import { partnerPortalPath, partnerPortalRoute } from "./partners/urls";
import { getPartnerAccess } from "./partners/guard";
import { getPortalAccess } from "./shasha";

// The VIP list and the blacklist are the same tool pointed at a different org.
//
// SHASHA is RNL's own copy; every partner gets theirs. They are one set of
// pages, one set of server actions and one set of components, over rows
// discriminated by `partnerId` — so a fix to the roster is a fix everywhere,
// rather than a fix that has to be remembered in n places.
//
// The two differ in exactly two ways, and this module is where both are
// resolved so that nothing downstream has to care:
//
//   who may write   SHASHA ranks off RNL's Roblox group (lib/shasha.ts).
//                   A partner's own people hold explicit grants — RNL does not
//                   own their group, so it cannot rank off it — while RNL staff
//                   ranked PARTNER_STAFF_RANK+ get in on the override. Both are
//                   resolved inside partners/guard.ts, so nothing here changes.
//
//   where it lives  /shasha/vip, vs /sleeptokenro/vip.
//
// Everything else — the queries, the audit trail, the forms — is shared.

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
  /** Public path on the portal host — for <Link> and redirect(). */
  basePath: string;
  /** Internal path Next renders at — for revalidatePath(). See partners/urls.ts. */
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
      // SHASHA is not rewritten — the portal host serves /shasha directly — so
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
 * no portal — so a caller cannot tell "no such partner" from "not your
 * partner", and cannot probe the registry by guessing slugs.
 *
 * Guarded PAGES must call this themselves before reading data, not lean on a
 * layout — see the note on requirePartnerUser() for why a layout guard still
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

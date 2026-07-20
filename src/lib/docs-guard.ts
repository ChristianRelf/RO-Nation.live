import "server-only";
import { redirect } from "next/navigation";
import { getUserSession } from "./session";
import {
  readableScopes,
  SHASHA_SCOPE,
  type ScopeGrant,
} from "./portal-scope";

// Who may read portal.ronation.live/docs - and it is two questions, not one.
//
// ---- The reading tier -------------------------------------------------
//
// The docs are the guides on running an event, the brand assets, and the API
// reference. Most of that is for anybody with a door on this platform: SHASHA
// staff, a partner's crew. A guide on working the door is worth nothing if the
// people working the door cannot read it - so the read tier deliberately
// includes read-only staff, who the API docs alone turn away.
//
// ---- The API tier -----------------------------------------------------
//
// /docs/api is different, and stricter. It names every endpoint that can issue,
// void and revoke a ticket, it explains that /purchase is trusted rather than
// verified, and it is the map somebody would want if they were planning to
// misuse a key they had found. None of that is a secret exactly - the security
// is the key, not the obscurity of the URL - but there is no reason to publish a
// how-to for the people with the most to gain from it.
//
// So: you may read the API docs if you can actually mint a key. Which is to say,
// if you MANAGE an organisation on this platform:
//
//   • SHASHA management (rank 245+ in RNL's group), or
//   • a MANAGER or OWNER of any partner (a PartnerMember row), or
//   • RNL staff on the 250+ override, which the partner guard already grants.
//
// A read-only staffer is not turned out of the docs for this - they are turned
// back to the docs index. The page is the companion to a key, and if you cannot
// hold a key it can only mislead you about what you are able to do.

// ------------------------------------------------------------------
// Tier 1 - the reader.
// ------------------------------------------------------------------

export type DocsReader = {
  displayName: string;
  avatarUrl?: string;
  /** Non-empty by construction - no grants means no reader. */
  scopes: ScopeGrant[];
  /**
   * Holds a write grant somewhere, which is exactly requireDocsUser()'s test -
   * so it is exactly who may open /docs/api. The nav uses it to decide whether
   * to show that link at all. Hiding it is courtesy; requireDocsUser() on the
   * page is the lock.
   */
  canMintKeys: boolean;
};

/**
 * The current docs reader, or null. Does not redirect - the layout needs to ask
 * without committing, and the guard below is what commits.
 */
export async function getDocsReader(): Promise<DocsReader | null> {
  const session = await getUserSession();
  if (!session) return null;

  const scopes = await readableScopes();
  if (!scopes.length) return null;

  return {
    displayName: session.displayName,
    avatarUrl: session.avatarUrl,
    scopes,
    canMintKeys: scopes.some((g) => g.canWrite),
  };
}

/**
 * Where to send somebody the docs will not let in.
 *
 * ---- Why this is two answers and not one -------------------------------
 *
 * There used to be a /docs/login carrying both. It is gone, and its two states
 * turned out to belong in two different places that already existed:
 *
 *   NOT SIGNED IN     → /login, the portal's one front door, carrying where they
 *                       were headed. (The gate in middleware.ts catches this
 *                       first in the ordinary case; this covers the request that
 *                       arrives with a cookie the gate accepts and the JWT check
 *                       then rejects.)
 *
 *   SIGNED IN, NO DOOR → /hub, NOT /login. Two reasons, and the first one is a
 *                       bug: /login redirects anybody holding a session straight
 *                       to `returnTo`, so sending them there would bounce them
 *                       back to /docs, back to here, back to /login, forever.
 *                       The second is that /hub already says this exact thing -
 *                       "you're signed in, but your account doesn't hold access
 *                       to any backstage area yet" - and says it better, because
 *                       it is the page that knows what a door IS.
 *
 * That second case is why the docs' own refusal page could be deleted while
 * SHASHA's and each partner's could not. Their refusals are specific - a rank
 * number, a per-account grant - and only make sense next to the thing being
 * refused. The docs' refusal is "you hold nothing ANYWHERE", which is a fact
 * about the person, not about the docs.
 */
// Returns the path rather than calling redirect() itself, deliberately: redirect()
// is typed `never`, and TypeScript only narrows on that when it is called at the
// call site. Awaiting a Promise<never> from a helper does not end the branch as far
// as control-flow analysis is concerned, so `reader` stayed DocsReader | null.
async function docsRefusalPath(): Promise<string> {
  const session = await getUserSession();
  return session ? "/hub" : `/login?returnTo=${encodeURIComponent("/docs")}`;
}

/**
 * Guard the docs. Called by the page itself - never left to a layout, for the
 * reason spelled out in lib/session.ts: a layout redirect still ships the page's
 * RSC payload in the body of the 307 it bounced you with.
 */
export async function requireDocsReader(): Promise<DocsReader> {
  const reader = await getDocsReader();
  if (!reader) redirect(await docsRefusalPath());
  return reader;
}

// ------------------------------------------------------------------
// Tier 2 - the key holder. /docs/api only.
// ------------------------------------------------------------------

export type DocsAccess = {
  displayName: string;
  /** The orgs this person manages. The docs use it to name their portal's key page. */
  orgs: { id: string; name: string; keysPath: string }[];
};

/**
 * Everyone whose keys page this person can actually open - the read tier with a
 * canWrite filter on the end. Built on the same walk, so the two tiers cannot
 * disagree about who holds what.
 */
async function managedOrgs(): Promise<DocsAccess["orgs"]> {
  const grants = await readableScopes();

  return grants
    .filter((g) => g.canWrite)
    .map((g) => ({
      id: g.scope.id,
      // The scope calls RNL's own portal "SHASHA" - the right name for a nav on
      // the portal, and the wrong one in a sentence about which ORG a key belongs
      // to. The key is RNL's; SHASHA is just where you go to mint it.
      name: g.scope.id === SHASHA_SCOPE ? "RO. Nation LIVE" : g.scope.name,
      keysPath: `${g.scope.basePath}/keys`,
    }));
}

/**
 * Guard /docs/api. Same page-not-layout rule as above.
 */
export async function requireDocsUser(): Promise<DocsAccess> {
  const session = await getUserSession();
  // The front door, returning to THIS page rather than the docs index - somebody
  // deep-linked to the API reference wants the API reference.
  if (!session) redirect(`/login?returnTo=${encodeURIComponent("/docs/api")}`);

  const orgs = await managedOrgs();
  // Signed in, reads the docs perfectly well, but manages nothing - so they can
  // never hold a key. Back to the index with a note, not out of the door: they
  // belong here, just not on this page.
  if (!orgs.length) redirect("/docs?error=keys");

  return { displayName: session.displayName, orgs };
}

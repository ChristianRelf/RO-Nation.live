import "server-only";
import { redirect } from "next/navigation";
import { getUserSession } from "./session";
import { getPortalAccess } from "./shasha";
import { getPartnerAccess } from "./partners/guard";
import { activePartners } from "./partners/registry";
import { partnerPortalPath } from "./partners/urls";

// Who may read portal.ronation.live/docs/api.
//
// The API docs are not a marketing page. They name every endpoint that can issue,
// void and revoke a ticket, they explain that /purchase is trusted rather than
// verified, and they are the map somebody would want if they were planning to
// misuse a key they had found. None of that is a secret exactly — the security is
// the key, not the obscurity of the URL — but there is no reason to publish a
// how-to for the people with the most to gain from it.
//
// So: you may read the docs if you can actually mint a key. Which is to say, if
// you MANAGE an organisation on this platform:
//
//   • SHASHA management (rank 245+ in RNL's group), or
//   • a MANAGER or OWNER of any partner (a PartnerMember row), or
//   • RNL staff on the 250+ override, which the partner guard already grants.
//
// Read-only staff are turned away, deliberately and with a reason: the page is the
// companion to a key, and if you cannot hold a key it can only mislead you about
// what you are able to do.

export type DocsAccess = {
  displayName: string;
  /** The orgs this person manages. The docs use it to name their portal's key page. */
  orgs: { id: string; name: string; keysPath: string }[];
};

/**
 * Everyone whose keys page this person can actually open.
 *
 * An empty list means no access — checked by the caller, not thrown here, so the
 * one guard below stays the only place that redirects.
 */
async function managedOrgs(): Promise<DocsAccess["orgs"]> {
  const orgs: DocsAccess["orgs"] = [];

  const shasha = await getPortalAccess();
  if (shasha.state === "allowed" && shasha.user.canWrite) {
    orgs.push({
      id: "shasha",
      name: "RO. Nation LIVE",
      keysPath: "/shasha/keys",
    });
  }

  // Sequential, not parallel, and that is fine: the partner list is short, and
  // each of these is a single indexed read plus a five-minute-cached rank lookup.
  for (const partner of activePartners()) {
    const access = await getPartnerAccess(partner.slug);
    if (access?.state === "allowed" && access.user.canWrite) {
      orgs.push({
        id: partner.slug,
        name: partner.name,
        keysPath: `${partnerPortalPath(partner.slug)}/keys`,
      });
    }
  }

  return orgs;
}

/**
 * Guard the docs. Called by the page itself — never left to a layout, for the
 * reason spelled out in lib/session.ts: a layout redirect still ships the page's
 * RSC payload in the body of the 307 it bounced you with.
 */
export async function requireDocsUser(): Promise<DocsAccess> {
  const session = await getUserSession();
  if (!session) redirect("/shasha/login");

  const orgs = await managedOrgs();
  // Signed in, and manages nothing. Not an error — they are simply not who this
  // page is for. Send them to the portal they CAN open rather than a wall.
  if (!orgs.length) redirect("/shasha");

  return { displayName: session.displayName, orgs };
}

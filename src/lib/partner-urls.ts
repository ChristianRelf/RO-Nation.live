import { env } from "./env";

// Where the partner programme lives. ONE module, and every link into it comes from here.
//
//   partner.ronation.live/            the programme - what it is, what it offers
//   partner.ronation.live/join/new    ask to become a partner
//   partner.ronation.live/invite/<uuid>  an invitation RNL handed out
//   partner.ronation.live/onboard     the guided setup, once you are in
//   partner.ronation.live/onboard/site/<uuid>  the brief we build your site from
//   partner.ronation.live/hub         the partner's own area - agreements, account, money
//
// The whole host rewrites to an internal /partner prefix (see src/middleware.ts), exactly
// as the accounts and pay hosts rewrite to /accounts and /pay. So INSIDE the host you link
// relatively - href="/hub/documents" - and these absolute builders are for everywhere
// else: the main site, the portal, the company desk, an email.
//
// ---- Not the same "partner" as lib/partners/urls.ts -------------------------
//
// That module builds <slug>.ronation.live for a partner's OWN site - a tenant, themed and
// routed from the registry. This one builds the single programme host, which belongs to
// RNL and has no tenant in it. Two different products that unavoidably share a word; the
// slug is what tells them apart, and there is no slug anywhere in this file.
//
// ---- CALL THESE ON THE SERVER ----------------------------------------------
//
// Everything here derives from env.siteUrl, which is NEXT_PUBLIC_SITE_URL, which Next
// inlines into the CLIENT bundle at BUILD time - and RNL's image is built without it. In a
// "use client" module these resolve correctly during the server render and then become
// http://partner.localhost:3000 the moment React hydrates. Resolve them in a server
// component and pass them down as props; lib/accounting/urls.ts documents the same trap at
// length, and PartnerShell already does it for PartnerNav.

/** ronation.live -> partner.ronation.live, preserving scheme and port. */
export function partnerProgramOrigin(): string {
  const url = new URL(env.siteUrl);
  url.hostname = `partner.${url.hostname.replace(/^www\./, "")}`;
  return url.origin;
}

/**
 * The addresses on the programme host, absolute.
 *
 * `hub` is the one that moved: the commercial-partner area used to be
 * portal.ronation.live/partner, and every link to it in the codebase now comes from here.
 * The old address still resolves - the middleware forwards it, and will keep forwarding it -
 * but a link that costs a redirect is a link that can also light up as "active" against a
 * path that no longer renders anything. See the note on the accounts nav.
 */
export const partnerUrls = {
  /** The programme itself. Public, anonymous, indexable. */
  home: () => partnerProgramOrigin(),
  /** The partner's own area - what used to be portal.ronation.live/partner. */
  hub: () => `${partnerProgramOrigin()}/hub`,
  /** Their agreements. */
  documents: () => `${partnerProgramOrigin()}/hub/documents`,
  /** Ask to become a partner. */
  join: () => `${partnerProgramOrigin()}/join/new`,
  /** An invitation, by its code. This is the string staff copy and send. */
  invite: (code: string) => `${partnerProgramOrigin()}/invite/${code}`,
  /** The guided setup. */
  onboard: () => `${partnerProgramOrigin()}/onboard`,
  /** A site brief, by its token. The other string staff copy and send. */
  brief: (token: string) => `${partnerProgramOrigin()}/onboard/site/${token}`,
  /** The "you are signed in, but not as a partner" landing. */
  access: () => `${partnerProgramOrigin()}/access`,
};

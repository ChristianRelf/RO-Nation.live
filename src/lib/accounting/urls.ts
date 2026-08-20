import type { AccountingDocument, DocumentKind } from "@prisma/client";
import { env } from "../env";
import { kindConfig } from "./kinds";

// Where the payment system lives. ONE module, and every link into it comes from here.
//
//   accounts.ronation.live   the STAFF side. Payroll, invoicing, receipts, the books,
//                            and the queue of requests from the other side.
//   pay.ronation.live        the CLIENT side. Statements, and the two forms - "I want to
//                            pay you" and "please pay me".
//
// Both are self-contained portals: reachable from portal.ronation.live/hub, and equally
// reachable by typing the name. Neither is a page inside something else.
//
// ---- Why absolute URLs, and why derived --------------------------------------
//
// These cross a host boundary, so a relative path cannot express them: /document/... on
// pay.ronation.live is a different page from /document/... on accounts.ronation.live.
// And they are DERIVED from env.siteUrl rather than written out, so localhost and
// production agree by construction - the same trick lib/sso.ts uses for its origins, and
// the reason a dev never has to special-case a link.
//
// ---- CALL THESE ON THE SERVER. This module is not marked server-only, and that
// ---- is a convenience, not permission.
//
// Every function here derives from env.siteUrl, which is NEXT_PUBLIC_SITE_URL. Next inlines
// NEXT_PUBLIC_* into the CLIENT bundle at BUILD time, and RNL's image is built without it
// (docker-compose passes it at runtime - see docker-compose.yml). So in a "use client"
// module these resolve correctly during the server render and then become
// http://accounts.localhost:3000 the moment React hydrates: a link that works until the
// page finishes loading, which is about the worst failure shape available.
//
// There is no `import "server-only"` because that would also ban TYPE imports and the
// type-only uses are fine. The rule is therefore a convention, and it is kept by resolving
// the origin in a server component and passing it down as a prop - which is what
// CompanyShell does for CompanyNav and PartnerShell for PartnerNav. If you find yourself
// calling accountsOrigin() at the top of a "use client" file, that is the bug.
//
// lib/site.ts documents the same trap from the other end, for site.domain.

/** ronation.live → accounts.ronation.live, preserving scheme and port. */
function subOrigin(prefix: string): string {
  const url = new URL(env.siteUrl);
  url.hostname = `${prefix}.${url.hostname.replace(/^www\./, "")}`;
  return url.origin;
}

/** https://accounts.ronation.live - the staff side of the payment system. */
export function accountsOrigin(): string {
  return subOrigin("accounts");
}

/** https://pay.ronation.live - the client side. */
export function payOrigin(): string {
  return subOrigin("pay");
}

/**
 * The two origins the payment system links OUT to, and it only links out to these.
 *
 * Both hosts are self-contained portals, so their chrome cannot borrow the company
 * sidebar or the portal nav - every link in those is a path on ANOTHER host, and a
 * relative <Link href="/company/events"> on accounts.ronation.live rewrites to
 * /accounts/company/events and 404s. That failure is silent until somebody clicks it,
 * which is why the handful of genuine cross-host links are absolute, and are all here.
 */
export const outboundUrls = {
  /** ronation.live/company - the authoring desk the accounting desk grew out of. */
  company: () => `${env.siteUrl}/company`,
  /** ronation.live/company/invoices - partner payout statements. A separate instrument. */
  payoutInvoices: () => `${env.siteUrl}/company/invoices`,
  /** ronation.live/company/tickets - where a comped or free ticket is voided. */
  tickets: () => `${env.siteUrl}/company/tickets`,
  /** ronation.live/company/partner-accounts - where a client's access to pay is granted. */
  partnerAccounts: () => `${env.siteUrl}/company/partner-accounts`,
  /** portal.ronation.live/hub - every door the signed-in person holds. */
  hub: () => `${subOrigin("portal")}/hub`,
  /**
   * partner.ronation.live/hub - the commercial-partner area.
   *
   * It moved off the portal host onto one of its own, and this is the address that
   * serves it. The old portal.ronation.live/partner still resolves - the middleware
   * forwards it and will keep forwarding it - but pointing a link there costs a
   * redirect on every click. lib/partner-urls.ts is the module that owns this host;
   * this entry stays here so the payment system keeps ONE list of everything it links
   * out to, which is the property outboundUrls exists for.
   */
  partnerArea: () => `${subOrigin("partner")}/hub`,
  /** ronation.live/contact - where a client queries something on their statement. */
  contact: () => `${env.siteUrl}/contact`,
};

/**
 * A document's path on the accounts host: /document/<kind>/<token>.
 *
 * The kind segment is presentation - the token alone identifies the document - but it is
 * not decoration. A link somebody was sent should say what it is before they open it, and
 * an invoice arriving as a bare 40-character string is a link people do not click. The
 * route checks the segment against the document's real kind, so this can never end up
 * telling the truth about the URL and lying about the paper.
 */
export function documentPath(doc: {
  kind: DocumentKind;
  shareToken: string | null;
}): string | null {
  if (!doc.shareToken) return null;
  return `/document/${kindConfig(doc.kind).slug}/${doc.shareToken}`;
}

/**
 * The absolute URL of a document - the string that gets sent to a counterparty.
 *
 * Always on the ACCOUNTS host, whichever host generated it. That is deliberate: a
 * document has exactly one address, so the link a partner reads off their statement on
 * pay.ronation.live and the link staff copy out of the desk are the same string, and
 * quoting one back at the other resolves.
 *
 * Null when the document is a draft. A draft has no token because it has nothing to
 * share - callers render nothing rather than a dead link.
 */
export function documentUrl(doc: {
  kind: DocumentKind;
  shareToken: string | null;
}): string | null {
  const path = documentPath(doc);
  return path ? `${accountsOrigin()}${path}` : null;
}

/** The staff desk's own view of a document, by id - not the share link. */
export function deskDocumentUrl(id: string): string {
  return `${accountsOrigin()}/${id}`;
}

/**
 * The kinds of thing on the client side, as absolute URLs.
 *
 * Used from the portal and the partner area, which are on OTHER hosts - inside the pay
 * area itself, link relatively (/statements), or the client router does a full page load
 * to the origin it is already on.
 */
export const payUrls = {
  home: () => payOrigin(),
  statements: () => `${payOrigin()}/statements`,
  makePayment: () => `${payOrigin()}/make-payment`,
  requestPayment: () => `${payOrigin()}/request-payment`,
  requests: () => `${payOrigin()}/requests`,
};

/** The same, for the staff side. */
export const accountsUrls = {
  home: () => accountsOrigin(),
  books: () => `${accountsOrigin()}/books`,
  requests: () => `${accountsOrigin()}/requests`,
  refund: () => `${accountsOrigin()}/refund`,
};

/** Convenience for the desk's own document list, which holds whole rows. */
export function shareUrlFor(doc: AccountingDocument): string | null {
  return documentUrl(doc);
}

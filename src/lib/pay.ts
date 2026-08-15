import "server-only";
import { redirect } from "next/navigation";
import {
  getPartnerAccountAccess,
  isFullPartner,
  type PartnerAccountUser,
} from "./partner-account";
import { needsPayTermsAcceptance } from "./accounting/pay-terms";

// Who may open pay.ronation.live.
//
// The same identity as everywhere else - one Roblox account, minted by
// authorise.ronation.live - and the same grant the /partner area already uses: a
// PartnerAccountMember row, written by RNL from /company/partner-accounts. There is no
// second concept of a "pay account" and there should not be one; the money on this host is
// scoped to a PartnerAccount entity, so the thing that may read it is a login attached to
// that entity.
//
// ---- Why this is not just requirePartnerAccount() -------------------------
//
// That guard redirects a stranger to /partner/access, which is a path on the PORTAL host.
// Called from here it would resolve against pay.ronation.live, get rewritten to
// /pay/partner/access, and 404 - so a partner who has not been granted access would be
// told the page does not exist rather than how to get in. Cross-host redirect targets are
// the recurring trap in this whole area; see the note in app/accounts/layout.tsx for the
// same bug in the other direction.
//
// Everything else about it is identical, on purpose: one grant, checked the same way, so a
// person's access to /partner and to pay cannot drift apart.

export type PayUser = PartnerAccountUser;

/**
 * Everything the door checks EXCEPT the payment terms.
 *
 * Its own function because two callers legitimately need to get this far and no further:
 * the terms gate itself (app/pay/terms), and the action that records an acceptance. Both
 * are reached BY somebody who has not accepted, so calling the full guard from either
 * would redirect them to the page they are already on, forever.
 *
 * Nothing else should call this. If you are writing a page under (app), you want
 * requirePayUser() below - this one opens the door to a person who has not agreed to
 * anything yet.
 */
export async function requirePayUserPreTerms(): Promise<PayUser> {
  const access = await getPartnerAccountAccess();
  if (access.state !== "allowed") redirect("/access");
  if (!isFullPartner(access.user.account)) redirect("/access?reason=potential");
  return access.user;
}

/**
 * The guard for every page under /pay, and for the two request actions.
 *
 * MUST be called by each page itself, not relied upon from the layout. A page segment is
 * serialised into the RSC payload in parallel with its layout, so a layout-only guard
 * still ships the page's body to somebody it just redirected. See lib/session.ts.
 *
 * Full PARTNER only. A POTENTIAL partner - somebody RNL is in talks with - has no
 * accounting and nothing to pay or be paid, which is the same line /partner/accounting
 * already draws (isFullPartner). They get /access, which says so in words rather than
 * showing them an empty statement and letting them wonder.
 *
 * ---- Why the terms check is HERE and not a modal in the layout ------------
 *
 * Because a modal in the layout is chrome, and chrome is not a gate. The layout note above
 * is the reason in full: a page segment is serialised into the RSC payload in parallel with
 * its layout, so an overlay rendered by the layout arrives alongside the statement it is
 * covering - the figures are in the payload, the dismiss is a DOM node, and anybody who
 * wants the page without agreeing to anything has it. The same applies to the server
 * actions, which a modal does not sit in front of at all.
 *
 * So the gate is a redirect out of the guard that every page and both client actions
 * already call. Nothing under (app) renders, and no request is submitted, until the row
 * says they accepted the current version. It still LOOKS like a modal - see the page it
 * lands on - because that is the right shape to read; it is simply one that cannot be
 * closed by pressing Escape.
 */
export async function requirePayUser(): Promise<PayUser> {
  const user = await requirePayUserPreTerms();
  if (needsPayTermsAcceptance(user.membership)) redirect("/terms");
  return user;
}

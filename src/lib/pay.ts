import "server-only";
import { redirect } from "next/navigation";
import {
  getPartnerAccountAccess,
  isFullPartner,
  type PartnerAccountUser,
} from "./partner-account";

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
 */
export async function requirePayUser(): Promise<PayUser> {
  const access = await getPartnerAccountAccess();
  if (access.state !== "allowed") redirect("/access");
  if (!isFullPartner(access.user.account)) redirect("/access?reason=potential");
  return access.user;
}

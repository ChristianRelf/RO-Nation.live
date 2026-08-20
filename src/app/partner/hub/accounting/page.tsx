import { redirect } from "next/navigation";
import { requirePartnerAccount, isFullPartner } from "@/lib/partner-account";
import { payUrls } from "@/lib/accounting/urls";

export const dynamic = "force-dynamic";

/**
 * partner.ronation.live/hub/accounting - now a redirect, and nothing else.
 *
 * The partner's ledger moved to pay.ronation.live/statements, where the rest of the
 * client-facing payment system lives. This page used to render the whole table; keeping a
 * second copy of it here is the one thing that must not happen, because two tables of the
 * same money on two hosts is two things that can disagree with each other.
 *
 * ---- Why a redirect rather than a 404 ------------------------------------
 *
 * Partners bookmark this. A 404 on a page about their own money reads as "our accounting
 * has been taken away", which is a support ticket at best.
 *
 * ---- Why the guard is still here -----------------------------------------
 *
 * The redirect target is on another host with its own guard, so this one is not what
 * protects anything. What it does is answer the two refusals HERE, where the person
 * already is: a POTENTIAL partner is sent back to their overview with the same notice they
 * would have got before, rather than bounced onto pay.ronation.live only to be turned away
 * by a page they have never seen. requirePartnerAccount handles the no-grant case the same
 * way it always did.
 */
export default async function PartnerAccountingRedirect() {
  const user = await requirePartnerAccount();
  if (!isFullPartner(user.account)) redirect("/hub?notice=accounting");

  redirect(payUrls.statements());
}

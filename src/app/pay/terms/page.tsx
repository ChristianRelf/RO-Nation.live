import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePayUserPreTerms } from "@/lib/pay";
import { needsPayTermsAcceptance, safeReturnTo } from "@/lib/accounting/pay-terms";
import { PayTermsGate } from "@/components/pay/terms-gate";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Payment terms",
  robots: { index: false, follow: false },
};

/**
 * The gate in front of pay.ronation.live.
 *
 * ---- Why it is OUTSIDE the (app) group ------------------------------------
 *
 * Exactly the reason /access is - and it is worth reading the note on that page, because
 * the failure mode is the same and it is silent. The (app) layout guards with
 * requirePayUser(), which redirects HERE when the terms are unaccepted. If this page sat
 * inside that group, arriving would redirect to the page that redirects you, forever, with
 * nothing on screen to explain it.
 *
 * So this route guards with requirePayUserPreTerms(): everything the door checks except the
 * terms themselves. Somebody with no grant still gets /access; somebody who is only a
 * prospective partner still gets /access?reason=potential. What lands here is precisely a
 * partner who may use this host and has not yet agreed to how it works.
 *
 * ---- And why somebody who HAS accepted is bounced out ---------------------
 *
 * This is a URL, so it can be opened directly. A person who has already accepted the
 * current version and lands here would be asked to accept something they have accepted,
 * and would reasonably wonder what had changed. Nothing had. They go to the overview.
 */
export default async function PayTermsPage({
  searchParams,
}: {
  searchParams: { error?: string; returnTo?: string };
}) {
  const user = await requirePayUserPreTerms();

  // Already accepted? Then honour the returnTo too - somebody who opened a deep link in a
  // second tab, accepted in the first, and came back to this one should land where they
  // were going, not be told to start again from the overview.
  const returnTo = safeReturnTo(searchParams.returnTo);
  if (!needsPayTermsAcceptance(user.membership)) redirect(returnTo);

  return (
    <PayTermsGate
      accountName={user.account.name}
      displayName={user.displayName}
      returnTo={returnTo}
      error={searchParams.error === "unconfirmed"}
      // They have accepted BEFORE, just not this version - so the card opens with "our
      // terms have changed" rather than asking a returning partner to accept as though
      // they had never seen any of it.
      reaccepting={Boolean(user.membership.payTermsAcceptedAt)}
    />
  );
}

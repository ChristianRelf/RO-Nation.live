import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPartnerAccountAccess, isFullPartner } from "@/lib/partner-account";
import { outboundUrls } from "@/lib/accounting/urls";
import { PortalFooter } from "@/components/portal-footer";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Access",
  robots: { index: false, follow: false },
};

/**
 * The refusal page for pay.ronation.live.
 *
 * ---- Why this exists at all, rather than reusing the partner host's /access ----
 *
 * Because that page is on the portal host. A cross-host redirect out of a guard would take
 * somebody OFF the thing they were trying to open in order to be told why they cannot open
 * it, and they would then have to find their way back. This says it here, on the host they
 * are on.
 *
 * ---- Why it is OUTSIDE the (app) group -----------------------------------
 *
 * The (app) layout guards with requirePayUser(), which redirects here. If this page were
 * inside that group, being refused would redirect to the page that redirects you, forever,
 * with nothing in the UI to explain it. See the note in app/pay/layout.tsx.
 *
 * ---- Two different refusals, two different answers -----------------------
 *
 * Somebody with NO grant is a stranger to the system and needs to be told who to ask.
 * Somebody who is a POTENTIAL partner has a relationship - it just is not a paying one yet
 * - and telling them "ask us for access" would be wrong, because they already did and the
 * answer is "when the agreement is signed". Two states, two sentences.
 */
export default async function PayAccessPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  const access = await getPartnerAccountAccess();

  // Somebody who CAN get in must not sit on a refusal page. This is reachable directly -
  // it is a URL - and a full partner landing here would be told they have no access while
  // holding it.
  if (access.state === "allowed" && isFullPartner(access.user.account)) {
    redirect("/");
  }

  const potential =
    searchParams.reason === "potential" ||
    (access.state === "allowed" && !isFullPartner(access.user.account));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="shell flex h-14 items-center gap-3">
          <span className="display text-xl leading-none tracking-tight">
            RO. Nation LIVE
          </span>
          <span aria-hidden className="hidden h-3.5 w-px bg-line-strong sm:block" />
          <span className="hidden text-[10px] font-bold uppercase tracking-kicker text-accent sm:inline">
            Payments
          </span>
        </div>
      </header>

      <main className="shell flex flex-1 items-center py-16">
        <div className="mx-auto max-w-lg">
          <Kicker>Payments</Kicker>

          {potential ? (
            <>
              <h1 className="display mt-4 text-4xl leading-none">Not yet</h1>
              <p className="mt-5 leading-relaxed text-muted">
                Your account is with us as a prospective partner, so there is no accounting
                on it yet - nothing has been invoiced, nothing is owed either way, and
                there would be nothing on this page to read.
              </p>
              <p className="mt-4 leading-relaxed text-muted">
                It opens by itself once the partnership is live. The agreements you accept
                on joining are in the partner area in the meantime.
              </p>
              <p className="mt-8">
                <a href={outboundUrls.partnerArea()} className="btn btn-accent">
                  Open the partner area ↗
                </a>
              </p>
            </>
          ) : (
            <>
              <h1 className="display mt-4 text-4xl leading-none">
                This account can&apos;t open payments
              </h1>
              <p className="mt-5 leading-relaxed text-muted">
                You are signed in
                {access.state === "denied" ? ` as ${access.session.displayName}` : ""}, but
                this Roblox account isn&apos;t attached to a RO. Nation LIVE partner
                account - which is what payments are scoped to. Nothing is wrong; it simply
                has not been granted.
              </p>
              <p className="mt-4 leading-relaxed text-muted">
                If you should have access, ask your contact at RO. Nation LIVE to add this
                Roblox account to your partner account. If you sign in with more than one
                account, check you are on the right one.
              </p>
              <p className="mt-8 flex flex-wrap gap-3">
                <a href={outboundUrls.contact()} className="btn btn-accent">
                  Get in touch ↗
                </a>
                {/* Same-host, so the cookie this clears is the one that was set here. */}
                <a href="/api/auth/logout?returnTo=/" className="btn">
                  Sign in as someone else
                </a>
              </p>
            </>
          )}
        </div>
      </main>

      <PortalFooter />
    </div>
  );
}

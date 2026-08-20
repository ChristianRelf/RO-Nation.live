import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPartnerAccountAccess } from "@/lib/partner-account";
import { outboundUrls } from "@/lib/accounting/urls";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Partner access",
  robots: { index: false, follow: false },
};

// partner.ronation.live/access - the unauthorised landing for the partner hub.
//
// It sits OUTSIDE the guarded /hub subtree so it can explain the situation without any
// guarded page rendering - the same split as /company/access and (dash), and the reason the
// old address was /partner/access rather than a path under the area itself.
//
// ---- Who actually gets here ------------------------------------------------
//
// Signed-in people with no PartnerAccount grant. That is the whole population, because an
// ANONYMOUS request to anything under /hub is stopped one layer earlier by the sign-in gate
// in the middleware and sent to /login (see PROGRAMME_PUBLIC_PATHS - /access is not on it).
// The anonymous branch below is therefore a fallback rather than a path anybody walks: it
// exists so that a change to that list degrades into an explanation instead of a blank page.
//
// ---- The link that must NOT be relative ------------------------------------
//
// "Backstage hub" means portal.ronation.live/hub, which is a completely different page from
// the /hub on THIS host - that one is the partner area they were just refused. A relative
// href would send a confused staffer in a circle. See lib/accounting/urls.ts on why the
// origin is resolved here, in a server component.
export default async function PartnerAccessPage() {
  const access = await getPartnerAccountAccess();
  if (access.state === "allowed") redirect("/hub");

  const backstageHub = outboundUrls.hub();

  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-72" />

      <div className="shell relative flex min-h-[70vh] items-center justify-center py-16">
        <div className="w-full max-w-md text-center">
          <Kicker>Partners only</Kicker>

          {access.state === "anonymous" ? (
            <>
              <h1 className="display mt-4 text-5xl">Partners</h1>
              <p className="mt-3 text-muted">
                Your agreements with RO. Nation LIVE, and - once you&apos;re a partner -
                your accounting. Sign in with the Roblox account we set your access up
                against.
              </p>
              <a
                href="/api/auth/roblox/login?returnTo=/hub"
                className="btn btn-accent mt-8 w-full"
              >
                Sign in with Roblox
              </a>
              <a href="/" className="link-underline mt-6 inline-block text-sm text-muted">
                Not a partner yet? Read about the programme
              </a>
            </>
          ) : (
            <>
              <h1 className="display mt-4 text-5xl">No access</h1>

              <div className="card mt-8 p-6 text-left">
                <p className="text-sm text-muted">
                  You&apos;re signed in as{" "}
                  <span className="font-semibold text-fg">
                    {access.session.displayName}
                  </span>
                  , but this area is for RO. Nation LIVE&apos;s partners, and that account
                  isn&apos;t set up as one.
                </p>
                <p className="mt-3 text-xs text-faint">
                  Expecting access? Ask your RO. Nation LIVE contact to add this Roblox
                  account - or sign in with the one they set up.
                </p>
              </div>

              {/* The one thing they CAN act on, and the reason this page is worth more
                  than a 403: there is now a front door, and they are standing next to it. */}
              <div className="card mt-4 border-accent/30 p-6 text-left">
                <p className="text-sm text-muted">
                  Not a partner yet, and think you should be?
                </p>
                <a href="/join/new" className="btn btn-accent mt-4 w-full">
                  Ask about partnering
                </a>
              </div>

              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <a href={backstageHub} className="btn btn-ghost">
                  Backstage hub ↗
                </a>
                <a href="/api/auth/logout?returnTo=/" className="btn btn-ghost">
                  Sign out
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

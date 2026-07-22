import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPartnerAccountAccess } from "@/lib/partner-account";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Partner access",
  robots: { index: false, follow: false },
};

// The unauthorised landing for the partner area. It sits OUTSIDE the guarded (app) group, so
// it can explain the situation without the guarded pages ever rendering - the same split as
// /company/access and (dash). Anonymous visitors are usually caught by the portal sign-in gate
// first (middleware → /login?returnTo=/partner); this page covers the signed-in-but-no-grant
// case, and is where requirePartnerAccount() sends anyone it turns away.
export default async function PartnerAccessPage() {
  const access = await getPartnerAccountAccess();
  if (access.state === "allowed") redirect("/partner");

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
                href="/api/auth/roblox/login?returnTo=/partner"
                className="btn btn-accent mt-8 w-full"
              >
                Sign in with Roblox
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

              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Link href="/hub" className="btn btn-ghost">
                  Backstage hub
                </Link>
                <a href="/api/auth/logout?returnTo=/partner" className="btn btn-ghost">
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

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { getCompanyAccess } from "@/lib/company";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Company access",
  robots: { index: false, follow: false },
};

// The unauthorised landing page for the Company. It sits OUTSIDE the guarded
// (dash) group, so it can explain the situation without the guarded pages ever
// being rendered — see the comment in (dash)/layout.tsx.
export default async function CompanyAccessPage() {
  const access = await getCompanyAccess();
  if (access.state === "allowed") redirect("/company");

  const membership = access.state === "denied" ? access.membership : null;

  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-72" />

      <div className="shell relative flex min-h-[70vh] items-center justify-center py-16">
        <div className="w-full max-w-md text-center">
          <Kicker>Crew only</Kicker>

          {access.state === "anonymous" ? (
            <>
              <h1 className="display mt-4 text-5xl">Company</h1>
              <p className="mt-3 text-muted">
                Events, the blog, surveys, careers and applications — all of
                ronation.live. Sign in with the Roblox account that holds your
                rank in the group.
              </p>
              <a
                href="/api/auth/roblox/login?returnTo=/company"
                className="btn btn-accent mt-8 w-full"
              >
                Sign in with Roblox
              </a>
              <p className="mt-4 text-xs text-faint">
                Rank {env.company.minRank} or above is required.
              </p>
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
                  , but the Company is limited to group members ranked{" "}
                  <span className="font-semibold text-fg">
                    {env.company.minRank}
                  </span>{" "}
                  or above.
                </p>
                <p className="mt-3 text-sm text-muted">
                  {membership
                    ? `Your rank is ${membership.rank} (${membership.roleName}).`
                    : "That account isn't in the group."}
                </p>
                <p className="mt-3 text-xs text-faint">
                  Just been promoted? It can take a few minutes to take effect
                  here. Otherwise, ask a group admin about your rank.
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Link href="/" className="btn btn-ghost">
                  Back to site
                </Link>
                <a href="/api/auth/logout" className="btn btn-ghost">
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

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { env, robloxConfigured } from "@/lib/env";
import { getPortalAccess } from "@/lib/shasha";
import { PortalFooter } from "@/components/portal-footer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "SHASHA - sign in",
  robots: { index: false, follow: false },
};

// Signing in with Roblox and *having access* are now two different things: the
// OAuth round trip succeeds for any Roblox account, and rank decides the rest.
// So this page has to handle the middle state - signed in, but not ranked high
// enough - or a junior member would be bounced back here on a loop with nothing
// to read. Same shape as /company/access.

const ERRORS: Record<string, string> = {
  denied: "Roblox sign-in was cancelled.",
  state: "That sign-in link expired. Give it another go.",
  exchange: "Roblox wouldn't complete the sign-in. Try again in a moment.",
  "not-configured":
    "Roblox sign-in isn't configured on this server yet (ROBLOX_CLIENT_ID / ROBLOX_CLIENT_SECRET).",
};

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: { error?: string; returnTo?: string };
}) {
  const access = await getPortalAccess();
  if (access.state === "allowed") redirect("/shasha");

  const message = searchParams.error ? ERRORS[searchParams.error] : null;
  const returnTo = searchParams.returnTo?.startsWith("/shasha")
    ? searchParams.returnTo
    : "/shasha";

  const membership = access.state === "denied" ? access.membership : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="relative flex-1">
        <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-72" />

        <div className="shell relative flex min-h-full items-center justify-center py-16">
          <div className="w-full max-w-sm">
            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
                RO. Nation LIVE
              </p>
              <h1 className="display mt-4 text-6xl">SHASHA</h1>
              <p className="mt-3 text-sm text-muted">
                VIP list &amp; blacklist. Staff access only.
              </p>
            </div>

            {access.state === "anonymous" ? (
              <div className="card mt-8 p-6">
                {message ? (
                  <p className="mb-4 border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    {message}
                  </p>
                ) : null}

                <a
                  href={`/api/auth/roblox/login?returnTo=${encodeURIComponent(returnTo)}`}
                  className={`btn w-full ${
                    robloxConfigured
                      ? "btn-accent"
                      : "btn-ghost pointer-events-none opacity-40"
                  }`}
                  aria-disabled={!robloxConfigured}
                >
                  Sign in with Roblox
                </a>

                <p className="mt-4 text-center text-xs text-faint">
                  Sign in with the Roblox account that holds your rank in the
                  group. Rank {env.shasha.minRank} or above is required.
                </p>
              </div>
            ) : (
              <div className="card mt-8 p-6">
                <h2 className="font-display text-xl uppercase">No access</h2>
                <p className="mt-3 text-sm text-muted">
                  You&apos;re signed in as{" "}
                  <span className="font-semibold text-fg">
                    {access.state === "denied"
                      ? access.session.displayName
                      : ""}
                  </span>
                  , but SHASHA is limited to group members ranked{" "}
                  <span className="font-semibold text-fg">
                    {env.shasha.minRank}
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
                  here. Otherwise, ask management about your rank.
                </p>

                <div className="mt-6 flex flex-col gap-2">
                  <a
                    href="/api/auth/logout?returnTo=/shasha/login"
                    className="btn btn-ghost w-full"
                  >
                    Sign out
                  </a>
                  <Link href="/" className="btn btn-ghost w-full">
                    Back to site
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <PortalFooter />
    </div>
  );
}

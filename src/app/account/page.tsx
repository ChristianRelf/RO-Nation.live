import type { Metadata } from "next";
import { getUserSession } from "@/lib/session";
import { devLoginEnabled, robloxConfigured } from "@/lib/env";
import { Kicker } from "@/components/ui";
import { getAccountHome } from "@/lib/account";
import { AccountHome } from "@/components/account/account-home";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your account" };

const errors: Record<string, string> = {
  "not-configured": "Roblox sign-in isn't configured on this server yet.",
  denied: "Sign-in was cancelled.",
  state: "Your sign-in session expired - please try again.",
  exchange: "We couldn't complete Roblox sign-in. Please try again.",
  disabled: "Dev login is disabled on this server.",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: { error?: string; returnTo?: string };
}) {
  const session = await getUserSession();

  // Signed in: this is the member's home now, not just a "you're signed in" card. The
  // signed-out branch below is unchanged - it is still the sign-in page.
  if (session) {
    const home = await getAccountHome(session.uid);
    return (
      <AccountHome
        home={home}
        displayName={session.displayName}
        username={session.username}
      />
    );
  }

  const returnTo =
    searchParams.returnTo && searchParams.returnTo.startsWith("/")
      ? searchParams.returnTo
      : "/tickets";
  const error = searchParams.error ? errors[searchParams.error] : null;

  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-72" />
      <div className="shell relative flex min-h-[70vh] items-center justify-center py-20">
        <div className="w-full max-w-md">
          <div className="text-center">
            <Kicker>Members</Kicker>
            <h1 className="display mt-4 text-4xl sm:text-5xl">
              Sign in to reserve
            </h1>
            <p className="mt-4 text-muted">
              Sign in with Roblox to reserve tickets. We only read your username
              and avatar - never your password.
            </p>
          </div>

          <div className="card mt-8 p-6">
            {error ? (
              <p className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </p>
            ) : null}

            <div className="space-y-4">
                {robloxConfigured ? (
                  <a
                    href={`/api/auth/roblox/login?returnTo=${encodeURIComponent(
                      returnTo,
                    )}`}
                    className="btn btn-accent w-full text-base"
                  >
                    Continue with Roblox
                  </a>
                ) : (
                  <p className="rounded-xl border border-line bg-bg px-4 py-3 text-sm text-muted">
                    Roblox OAuth isn&apos;t configured yet. Add{" "}
                    <code className="font-mono text-fg">ROBLOX_CLIENT_ID</code>{" "}
                    and{" "}
                    <code className="font-mono text-fg">
                      ROBLOX_CLIENT_SECRET
                    </code>{" "}
                    to enable it.
                  </p>
                )}

                {devLoginEnabled ? (
                  <>
                    <div className="flex items-center gap-3 text-xs text-faint">
                      <span className="h-px flex-1 bg-line" />
                      DEV LOGIN
                      <span className="h-px flex-1 bg-line" />
                    </div>
                    <form
                      action="/api/auth/dev"
                      method="post"
                      className="space-y-3"
                    >
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <input
                        name="username"
                        placeholder="Pick a test username"
                        className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none focus:border-accent"
                      />
                      <button className="btn btn-ghost w-full">
                        Continue as test user
                      </button>
                    </form>
                    <p className="text-center text-xs text-faint">
                      Only shown locally. Disabled once Roblox OAuth is set up.
                    </p>
                  </>
                ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { isKnownOrigin } from "@/lib/sso";
import { PortalFooter } from "@/components/portal-footer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sign in - RO. Nation LIVE",
  robots: { index: false, follow: false },
};

// The only page on authorise.ronation.live.
//
// Nobody should ever see it in the normal run of things: the sign-in flow passes
// straight through this host in two redirects, and if it is working you are gone
// before anything renders. It exists for the times it doesn't work - a cancelled
// Roblox prompt, an expired link - because those failures happen HERE, and the
// /shasha and /docs login pages this app would otherwise send you back to do not
// exist on this host.
//
// It deliberately shows nothing about who you are, even when a session cookie is
// sitting right there. This host holds the identity for every other one; it is not
// a place to browse.

const ERRORS: Record<string, string> = {
  denied: "Roblox sign-in was cancelled.",
  state: "That sign-in link expired. Start again from where you were.",
  exchange: "Roblox wouldn't complete the sign-in. Try again in a moment.",
  origin:
    "That sign-in link pointed somewhere we don't recognise, so it was refused.",
  "not-configured":
    "Roblox sign-in isn't configured on this server yet (ROBLOX_CLIENT_ID / ROBLOX_CLIENT_SECRET).",
};

export default function AuthorisePage({
  searchParams,
}: {
  searchParams: { error?: string; to?: string };
}) {
  const message = searchParams.error ? ERRORS[searchParams.error] : null;

  // Where they were headed when it went wrong, so there is a way back. Validated
  // against the same allowlist the ticket mint uses - this ends up in an href, and
  // an unchecked `to` would make this page an open redirect that lives on the
  // sign-in host, which is precisely where a phishing link would want to live.
  const back =
    searchParams.to && isKnownOrigin(searchParams.to) ? searchParams.to : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="relative flex-1">
        <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-72" />

        <div className="shell relative flex min-h-full items-center justify-center py-16">
          <div className="w-full max-w-sm text-center">
            <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
              RO. Nation LIVE
            </p>
            <h1 className="display mt-4 text-5xl">Sign in</h1>

            {message ? (
              <>
                <div className="card mt-8 p-6 text-left">
                  <p className="text-sm text-red-300">{message}</p>
                </div>
                <div className="mt-6 flex flex-col gap-2">
                  {back ? (
                    <a href={back} className="btn btn-accent w-full">
                      Try again
                    </a>
                  ) : null}
                  <a href="https://ronation.live" className="btn btn-ghost w-full">
                    Back to ronation.live
                  </a>
                </div>
              </>
            ) : (
              <>
                <p className="mt-4 text-sm text-muted">
                  This is where signing in happens for RO. Nation LIVE. There is
                  nothing to do here - start from the page you actually wanted, and
                  it will send you through.
                </p>
                <a
                  href="https://ronation.live"
                  className="btn btn-ghost mt-8 w-full"
                >
                  Back to ronation.live
                </a>
              </>
            )}
          </div>
        </div>
      </main>

      <PortalFooter />
    </div>
  );
}

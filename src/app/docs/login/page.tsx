import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { robloxConfigured } from "@/lib/env";
import { getUserSession } from "@/lib/session";
import { readableScopes } from "@/lib/portal-scope";
import { PortalFooter } from "@/components/portal-footer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Docs - sign in",
  robots: { index: false, follow: false },
};

// The docs' own front door. It sits OUTSIDE the (reader) group, so it can explain
// itself without any guarded page being rendered.
//
// It cannot be /shasha/login, which is what the docs used to bounce to. That page
// sanitises returnTo against "/shasha" and throws away anything else, and its
// denial copy talks about your rank in RNL's Roblox group - which is meaningless
// to a partner's manager, who has no rank in that group at all and is perfectly
// entitled to read the docs.

const ERRORS: Record<string, string> = {
  denied: "Roblox sign-in was cancelled.",
  state: "That sign-in link expired. Give it another go.",
  exchange: "Roblox wouldn't complete the sign-in. Try again in a moment.",
  "not-configured":
    "Roblox sign-in isn't configured on this server yet (ROBLOX_CLIENT_ID / ROBLOX_CLIENT_SECRET).",
};

export default async function DocsLoginPage({
  searchParams,
}: {
  searchParams: { error?: string; returnTo?: string };
}) {
  const session = await getUserSession();
  const scopes = session ? await readableScopes() : [];

  // Already in. A bookmarked login page shouldn't dead-end.
  if (session && scopes.length) redirect("/docs");

  const message = searchParams.error ? ERRORS[searchParams.error] : null;
  const returnTo = searchParams.returnTo?.startsWith("/docs")
    ? searchParams.returnTo
    : "/docs";

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
              <h1 className="display mt-4 text-5xl">Docs</h1>
              <p className="mt-3 text-sm text-muted">
                Guides, brand assets and the API reference. Staff and partner
                crew.
              </p>
            </div>

            {!session ? (
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
                  Sign in with the Roblox account that holds your rank or your
                  partner crew place.
                </p>
              </div>
            ) : (
              <div className="card mt-8 p-6">
                <h2 className="font-display text-xl uppercase">No access</h2>
                <p className="mt-3 text-sm text-muted">
                  You&apos;re signed in as{" "}
                  <span className="font-semibold text-fg">
                    {session.displayName}
                  </span>
                  , but the docs are for RNL staff and partner crew - and that
                  account is neither.
                </p>
                {/* Deliberately no list of who DOES get in, and no rank number:
                    this page is reachable by anybody with a Roblox account. */}
                <p className="mt-3 text-xs text-faint">
                  Just been added to a crew, or just been promoted? It can take a
                  few minutes to take effect here.
                </p>

                <div className="mt-6 flex flex-col gap-2">
                  <a
                    href="/api/auth/logout?returnTo=/docs/login"
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

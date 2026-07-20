import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { getPortalAccess } from "@/lib/shasha";
import { PortalFooter } from "@/components/portal-footer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "SHASHA - sign in",
  robots: { index: false, follow: false },
};

// Signing in with Roblox and *having access* are two different things: the OAuth
// round trip succeeds for any Roblox account, and rank decides the rest.
//
// ---- This page is now only the SECOND half of that ------------------------
//
// It used to be both, and so did /<slug>/login and /docs/login - three pages each
// carrying its own copy of the same "Sign in with Roblox" button. That half moved
// to /login, which every anonymous request to this host now reaches by way of the
// gate in middleware.ts.
//
// What stayed is the half that could never have been shared: NO ACCESS, explained
// in terms of SHASHA. A rank number in RNL's Roblox group is the reason here, and
// it is meaningless in a partner's portal or in the docs - which is exactly the
// bug docs/login was created to fix, when the docs bounced people to this page and
// told a partner's manager to go and get a rank they will never have.
//
// So: anonymous is somebody else's job now, denied is still ours.

export default async function ShashaAccessPage({
  searchParams,
}: {
  searchParams: { returnTo?: string };
}) {
  const access = await getPortalAccess();
  if (access.state === "allowed") redirect("/shasha");

  const returnTo = searchParams.returnTo?.startsWith("/shasha")
    ? searchParams.returnTo
    : "/shasha";

  // Not signed in at all - there is nothing for this page to explain yet. The one
  // sign-in page handles it, and comes back here afterwards if the rank is short.
  if (access.state === "anonymous") {
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

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

            {/* Only one state left to draw - anonymous redirected out above. */}
            <div className="card mt-8 p-6">
              <h2 className="font-display text-xl uppercase">No access</h2>
              <p className="mt-3 text-sm text-muted">
                You&apos;re signed in as{" "}
                <span className="font-semibold text-fg">
                  {access.state === "denied" ? access.session.displayName : ""}
                </span>
                , but SHASHA is limited to group members ranked{" "}
                <span className="font-semibold text-fg">
                  {env.shasha.minRank}
                </span>{" "}
                or above, plus anyone RNL has granted access to directly.
              </p>
              <p className="mt-3 text-sm text-muted">
                {membership
                  ? `Your rank is ${membership.rank} (${membership.roleName}).`
                  : "That account isn't in the group."}{" "}
                {/* The grant is checked on this account too, and it did not find
                    one - so "ask for a rank" is no longer the only way out, and
                    saying so saves a round of the wrong request. */}
                There&apos;s no direct grant on it either.
              </p>
              <p className="mt-3 text-xs text-faint">
                Just been promoted or just been granted access? It can take a few
                minutes to take effect here. Otherwise, ask management about your
                rank - or to be added directly.
              </p>

              <div className="mt-6 flex flex-col gap-2">
                {/* Somewhere to GO, not just out. This card is a dead end for
                    somebody who holds a partner portal but not SHASHA, and the
                    hub is the page that knows which doors those are. */}
                <Link href="/hub" className="btn btn-accent w-full">
                  See what you can open
                </Link>
                <a
                  href="/api/auth/logout?returnTo=/login"
                  className="btn btn-ghost w-full"
                >
                  Sign out
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      <PortalFooter />
    </div>
  );
}

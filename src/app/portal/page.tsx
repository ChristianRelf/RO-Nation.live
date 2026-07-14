import type { Metadata } from "next";
import Link from "next/link";
import { PortalFooter } from "@/components/portal-footer";

// The front door of portal.ronation.live. It used to redirect straight to
// /shasha, which met anyone without staff rank with a login wall and no
// explanation of where they had landed.
//
// It names the host and nothing else. No links to the tools behind it: whoever
// belongs here already knows the path they want, and everyone else is better
// told "this is not for you" than handed a map. That is also why /docs is not
// mentioned - the API docs are the companion to a key, and a visitor without one
// has no reason to know they exist.
//
// Reached by rewrite from `/` on the portal host - see src/middleware.ts.

export const metadata: Metadata = {
  title: "Backstage portal",
  robots: { index: false, follow: false },
};

export default function PortalHomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="relative flex-1">
        <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-72" />

        <div className="shell relative flex min-h-full items-center justify-center py-16">
          <div className="w-full max-w-md text-center">
            <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
              RO. Nation LIVE
            </p>
            <h1 className="display mt-4 text-5xl sm:text-6xl">
              Backstage portal
            </h1>
            <p className="mt-5 text-sm text-muted">
              Staff and partners only. Everything here is behind a door, and the
              door needs your name on it.
            </p>
            <p className="mt-3 text-sm text-faint">
              If you were sent here, you were sent a link. Use that.
            </p>

            {/* The one door that is safe to show everyone: the hub itself decides what you
                may open, and greets a signed-out visitor with a sign-in rather than a wall. */}
            <Link href="/hub" className="btn btn-accent mt-8">
              Open your hub →
            </Link>

            <p className="mt-10 text-xs text-faint">
              Looking for shows and tickets?{" "}
              <a
                href="https://ronation.live"
                className="font-semibold text-muted transition-colors hover:text-accent"
              >
                ronation.live
              </a>
            </p>
          </div>
        </div>
      </main>

      <PortalFooter />
    </div>
  );
}

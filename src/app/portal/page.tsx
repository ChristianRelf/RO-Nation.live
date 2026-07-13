import type { Metadata } from "next";
import Link from "next/link";
import { PortalFooter } from "@/components/portal-footer";

// The front door of portal.ronation.live. It used to redirect straight to
// /shasha, which meant anyone who landed here without staff rank got a login
// wall and no explanation of what they had arrived at. Nothing on this page is
// gated, so it says nothing a signed-out visitor shouldn't see: what the host
// is, and where the two doors are.
//
// Reached by rewrite from `/` on the portal host — see src/middleware.ts.

export const metadata: Metadata = {
  title: "Backstage portal",
  description:
    "The backstage portal for RO. Nation LIVE — staff tools and partner portals.",
  robots: { index: false, follow: false },
};

const doors = [
  {
    href: "/shasha",
    title: "SHASHA",
    body: "VIP list, blacklist and audit trail. RNL staff, ranked group members only.",
  },
  {
    href: "/docs/api",
    title: "API docs",
    body: "The companion to an API key: ticket verification, gifting and revocation.",
  },
];

export default function PortalHomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="relative flex-1">
        <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-72" />

        <div className="shell relative flex min-h-full items-center justify-center py-16">
          <div className="w-full max-w-xl">
            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
                RO. Nation LIVE
              </p>
              <h1 className="display mt-4 text-5xl sm:text-6xl">
                Backstage portal
              </h1>
              <p className="mt-4 text-sm text-muted">
                This is the backstage portal — the staff and partner side of RO.
                Nation LIVE. Nothing here is public. If you&apos;re after shows
                and tickets, the site is over at{" "}
                <a
                  href="https://ronation.live"
                  className="font-semibold text-fg transition-colors hover:text-accent"
                >
                  ronation.live
                </a>
                .
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {doors.map((d) => (
                <Link
                  key={d.href}
                  href={d.href}
                  className="card p-6 transition-colors hover:border-accent"
                >
                  <h2 className="font-display text-xl uppercase">{d.title}</h2>
                  <p className="mt-2 text-sm text-muted">{d.body}</p>
                </Link>
              ))}
            </div>

            <p className="mt-8 text-center text-xs text-faint">
              Partner portals live at portal.ronation.live/&lt;your slug&gt; —
              use the link your RNL contact gave you.
            </p>
          </div>
        </div>
      </main>

      <PortalFooter />
    </div>
  );
}

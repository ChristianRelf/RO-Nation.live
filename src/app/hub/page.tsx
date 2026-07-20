import type { Metadata } from "next";
import { robloxConfigured } from "@/lib/env";
import { getHubDashboard, type HubAreaLive } from "@/lib/hub-dashboard";
import type { HubLink } from "@/lib/hub";
import { PortalFooter } from "@/components/portal-footer";
import { HubHeader } from "@/components/hub/hub-header";
import { HubAnchor } from "@/components/hub/hub-anchor";
import { AreaCard } from "@/components/hub/area-card";
import { ActivityFeed } from "@/components/hub/activity-feed";
import { MarkSeen } from "@/components/hub/mark-seen";

// portal.ronation.live/hub - the backstage dashboard.
//
// It began as a launcher: every door you hold, so you did not have to know the URL.
// That was the right first problem to solve and the wrong place to stop - a list of
// links tells you where you may go and nothing about whether you need to. So each
// card now carries the state of the area behind it, and a feed says what has
// happened across all of them.
//
// The data comes from getHubDashboard() (lib/hub-dashboard.ts), NOT getHubData().
// The distinction is load-bearing and is argued at both ends - see the note on
// getPortalSwitcher() in lib/hub.ts before importing the dashboard anywhere else.
//
// Reached at /hub on the portal host; served there by the middleware, which also
// gives it portal chrome (no marketing header/footer) via areaFor().

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Backstage hub",
  robots: { index: false, follow: false },
};

export default async function HubPage() {
  const { session, areas, quickLinks, signInHref, feed } =
    await getHubDashboard();

  if (!session) {
    return (
      <div className="flex min-h-dvh flex-col">
        <HubHeader session={null} />
        <main className="shell flex-1 py-10 sm:py-14">
          <SignedOut signInHref={signInHref} />
        </main>
        <PortalFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <HubHeader session={session} />

      <main className="shell flex-1 py-10 sm:py-14">
        <div className="fade-in-1 mb-10">
          <h1 className="display text-4xl sm:text-5xl">
            Welcome back, {session.displayName.split(" ")[0]}.
          </h1>
          <p className="mt-3 text-sm text-muted">{summarise(areas)}</p>

          {quickLinks.length ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {quickLinks.map((l) => (
                <QuickLink key={l.href} link={l} />
              ))}
            </div>
          ) : null}
        </div>

        {areas.length ? (
          <div className="fade-in-2 grid items-start gap-6 lg:grid-cols-[1fr_360px]">
            <div className="grid gap-4 md:grid-cols-2">
              {areas.map((area) => (
                <AreaCard key={area.id} area={area} />
              ))}
            </div>

            <ActivityFeed entries={feed} />
            {/* Advances the "last here" cookie once the page has rendered. A
                render cannot set a cookie in Next 14, hence the round trip. */}
            <MarkSeen />
          </div>
        ) : (
          <NoAreas />
        )}
      </main>

      <PortalFooter />
    </div>
  );
}

/**
 * The one-line state of the whole estate: how many areas, how many shows are close,
 * and whether anything is asking to be looked at.
 *
 * "1 thing needs attention" is deliberately a count and not a list. The chips on
 * the cards are the list; repeating them here would mean reading the same warning
 * twice before finding out which area it belongs to.
 */
function summarise(areas: HubAreaLive[]) {
  const parts = [`${areas.length} area${areas.length === 1 ? "" : "s"}`];

  const shows = areas.filter((a) => a.nextShow).length;
  if (shows) parts.push(`${shows} show${shows === 1 ? "" : "s"} coming up`);

  const flags = areas.reduce((n, a) => n + a.attention.length, 0);
  if (flags) parts.push(`${flags} thing${flags === 1 ? "" : "s"} to look at`);

  return `${parts.join(" · ")}.`;
}

function QuickLink({ link }: { link: HubLink }) {
  return (
    <HubAnchor
      href={link.href}
      external={link.external}
      className="rounded-brand border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:border-line-strong hover:text-fg"
    >
      {link.label}
      {link.external ? " ↗" : ""}
    </HubAnchor>
  );
}

function SignedOut({ signInHref }: { signInHref: string }) {
  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-72" />
      <div className="relative flex min-h-[50vh] items-center justify-center">
        <div className="w-full max-w-md text-center">
          <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
            RO. Nation LIVE
          </p>
          <h1 className="display mt-4 text-5xl sm:text-6xl">Backstage hub</h1>
          <p className="mt-5 text-sm text-muted">
            Sign in to see every area your account can open - SHASHA, a partner
            portal, the Company dashboard, the docs.
          </p>

          <a
            href={robloxConfigured ? signInHref : undefined}
            className={`btn mt-8 w-full ${
              robloxConfigured
                ? "btn-accent"
                : "btn-ghost pointer-events-none opacity-40"
            }`}
            aria-disabled={!robloxConfigured}
          >
            Sign in with Roblox
          </a>

          <p className="mt-6 text-xs text-faint">
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
    </div>
  );
}

function NoAreas() {
  return (
    <div className="card p-8 text-center">
      <h3 className="font-display text-xl uppercase">Nothing assigned yet</h3>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted">
        You&apos;re signed in, but your account doesn&apos;t hold access to any
        backstage area yet. Access is a rank in RO. Nation LIVE&apos;s Roblox
        group, or a grant from a partner - if you were expecting a door here, ask
        whoever sent you.
      </p>
      <p className="mt-3 text-xs text-faint">
        Just been promoted? Ranks can take a few minutes to take effect here.
      </p>
    </div>
  );
}

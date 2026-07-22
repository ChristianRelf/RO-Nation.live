import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { robloxConfigured } from "@/lib/env";
import { getHubDashboard, type HubAreaLive } from "@/lib/hub-dashboard";
import { getPartnerAccountAccess } from "@/lib/partner-account";
import { PortalFooter } from "@/components/portal-footer";
import { HubHeader } from "@/components/hub/hub-header";
import { HubButton, HubChip } from "@/components/hub/hub-button";
import { NowBoard } from "@/components/hub/now-board";
import { AttentionBoard } from "@/components/hub/attention-board";
import { AreaRow } from "@/components/hub/area-row";
import { ActivityFeed } from "@/components/hub/activity-feed";
import { MarkSeen } from "@/components/hub/mark-seen";

// portal.ronation.live/hub - the backstage dashboard.
//
// It began as a launcher: every door you hold, so you did not have to know the URL.
// That was the right first problem to solve and the wrong place to stop - a list of
// links tells you where you may go and nothing about whether you need to. So the
// page carries the state of the areas behind it, and a feed says what has happened
// across all of them.
//
// ---- Why this is a column and not a grid ----------------------------------
//
// The second version was a grid of equal cards with the feed in a sidebar, and it
// had one flaw that no amount of styling fixes: equal cards make an equal claim.
// A house opening in two hours and a docs area nobody has touched in a month were
// the same size, in the same place, carrying the same furniture. The reader did
// the triage the page should have done.
//
// So it is now ordered by urgency, top to bottom, and each band is a different
// weight on purpose:
//
//   1. Up next    - the single closest show ANYWHERE you hold a door.
//   2. Needs you  - every flag, across every area, hoisted out of the cards.
//   3. Your doors - the areas, as rows, for when neither of the above applies.
//   4. Lately     - the audit trail, full width.
//
// Bands 1 and 2 are absent when empty rather than zeroed, which is what makes the
// ordering trustworthy: if something is at the top of this page, it is because
// there is something there.
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

  // A pure partner account holds no staff or partner-tenant door, so getHubDashboard returns
  // no areas - and the hub, with its "Nothing assigned yet" panel, is not their home. Send
  // them to /partner, which is. A staffer who ALSO holds a partner grant keeps the hub: they
  // have areas, so this never fires for them. Checked only when areas is empty, so the extra
  // lookup stays off the hot path for everyone who does hold a door.
  if (areas.length === 0) {
    const partner = await getPartnerAccountAccess();
    if (partner.state === "allowed") redirect("/partner");
  }

  // The closest show anywhere. Sorted on NextShow.at, which exists for this -
  // `relative` and `when` are display strings and would sort "Fri" against
  // "In 2 weeks".
  const upNext =
    areas
      .filter((a) => a.nextShow)
      .sort((a, b) => a.nextShow!.at.getTime() - b.nextShow!.at.getTime())[0] ??
    null;

  return (
    <div className="flex min-h-dvh flex-col">
      <HubHeader session={session} />

      <main className="shell flex-1 py-10 sm:py-14">
        <Masthead
          name={session.displayName.split(" ")[0]}
          areas={areas}
          quickLinks={quickLinks}
        />

        {areas.length ? (
          <div className="mt-12 space-y-14">
            {upNext ? (
              <div className="fade-in-2">
                <NowBoard area={upNext} scopeCount={areas.length} />
              </div>
            ) : null}

            <div className="fade-in-2">
              <AttentionBoard areas={areas} />
            </div>

            <section className="fade-in-3">
              <div className="flex items-baseline gap-3">
                <h2 className="display text-lg leading-none">Your doors</h2>
                <span aria-hidden className="h-px flex-1 bg-line" />
                <span className="tnum text-[10px] font-bold uppercase tracking-kicker text-faint">
                  {areas.length}
                </span>
              </div>

              {/* border-t on each row, plus one on the list's end, so the run of
                  rules closes rather than trailing off after the last name. */}
              <ul className="mt-2 border-b border-line">
                {areas.map((area, i) => (
                  <AreaRow key={area.id} area={area} index={i} />
                ))}
              </ul>
            </section>

            <div className="fade-in-3">
              <ActivityFeed entries={feed} />
            </div>

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
 * Who you are, and the state of the whole estate as three figures.
 *
 * This replaced a sentence - "4 areas · 2 shows coming up · 1 thing to look at."
 * The sentence was accurate and it was still prose, which is the one shape a
 * number should never take on a dashboard: it has to be read left to right before
 * it can be compared to how it looked yesterday. Three tabular figures under three
 * fixed labels can be compared without being read.
 *
 * "Needs you" is deliberately a count and not a list. AttentionBoard is the list;
 * repeating it here would mean reading the same warning twice before finding out
 * which area it belongs to.
 */
function Masthead({
  name,
  areas,
  quickLinks,
}: {
  name: string;
  areas: HubAreaLive[];
  quickLinks: { label: string; href: string; external?: boolean }[];
}) {
  const shows = areas.filter((a) => a.nextShow).length;
  const flags = areas.reduce((n, a) => n + a.attention.length, 0);

  return (
    <div className="fade-in-1">
      <div className="flex flex-col gap-8 border-b border-line pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-kicker text-accent">
            Backstage
          </p>
          <h1 className="display mt-3 text-4xl leading-none sm:text-5xl">
            Welcome back, {name}.
          </h1>
        </div>

        <dl className="flex gap-8 sm:gap-12">
          <Readout label="Areas" value={areas.length} />
          <Readout label="Shows ahead" value={shows} />
          <Readout label="Needs you" value={flags} tone={flags ? "alert" : undefined} />
        </dl>
      </div>

      {quickLinks.length ? (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-kicker text-faint">
            Pinned
          </span>
          {quickLinks.map((l) => (
            <HubChip key={l.href} href={l.href} external={l.external}>
              {l.label}
            </HubChip>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Readout({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "alert";
}) {
  return (
    <div>
      <dd
        className={`tnum display text-4xl leading-none ${
          tone === "alert" ? "text-amber-300" : ""
        }`}
      >
        {value}
      </dd>
      <dt className="mt-2 text-[10px] font-bold uppercase tracking-kicker text-faint">
        {label}
      </dt>
    </div>
  );
}

function SignedOut({ signInHref }: { signInHref: string }) {
  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-72" />

      {/* Left-aligned against a rule rather than floated in the middle of the
          viewport. The signed-in page is a column with a hard left edge; the door
          into it should stand in the same place. */}
      <div className="relative flex min-h-[60vh] items-center">
        <div className="w-full max-w-xl">
          <p className="text-[10px] font-bold uppercase tracking-kicker text-accent">
            RO. Nation LIVE
          </p>
          <h1 className="display mt-4 text-5xl leading-none sm:text-7xl">
            Backstage
            <br />
            hub
          </h1>

          <div aria-hidden className="mt-8 h-px w-full max-w-xs bg-line-strong" />

          <p className="mt-8 max-w-md text-sm text-muted">
            Sign in to see every area your account can open - SHASHA, a partner
            portal, the Company dashboard, the docs.
          </p>

          <div className="mt-8">
            {robloxConfigured ? (
              <HubButton href={signInHref} variant="accent">
                Sign in with Roblox
              </HubButton>
            ) : (
              <span
                aria-disabled
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-brand border border-line px-5 py-2.5 text-[11px] font-bold uppercase tracking-kicker text-faint opacity-50"
              >
                Sign in unavailable
              </span>
            )}
          </div>

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
    </div>
  );
}

function NoAreas() {
  return (
    <div className="mt-12 border-t border-line pt-10">
      <h3 className="display text-2xl leading-none">Nothing assigned yet</h3>
      <p className="mt-4 max-w-md text-sm text-muted">
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

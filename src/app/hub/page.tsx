import type { Metadata } from "next";
import Link from "next/link";
import { robloxConfigured } from "@/lib/env";
import { getHubData, type HubArea, type HubLink } from "@/lib/hub";
import { PortalFooter } from "@/components/portal-footer";

// portal.ronation.live/hub - the backstage launcher.
//
// One page that shows a signed-in person every door they hold and nothing else. It replaces
// the old state of affairs where the portal host had no landing worth the name: you either
// knew the exact URL of your tool or you were stuck. See lib/hub.ts for how the areas are
// resolved (by the real guards, never a second copy of them).
//
// Reached at /hub on the portal host; served there by the middleware, which also gives it
// portal chrome (no marketing header/footer) via areaFor().

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Backstage hub",
  robots: { index: false, follow: false },
};

export default async function HubPage() {
  const { session, areas, quickLinks, signInHref } = await getHubData();

  return (
    <div className="flex min-h-dvh flex-col">
      {/* A light header of its own - not PortalNav, which is scoped to one portal's
          basePath. The hub sits above all of them. */}
      <header className="border-b border-line">
        <div className="shell flex h-16 items-center justify-between gap-6">
          <Link href="/hub" className="flex items-baseline gap-2">
            <span className="display text-2xl tracking-tight">RO. Nation LIVE</span>
            <span className="hidden text-[10px] font-bold uppercase tracking-kicker text-accent sm:inline">
              Backstage
            </span>
          </Link>

          {session ? (
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold leading-tight">{session.displayName}</p>
                <p className="text-[10px] font-bold uppercase tracking-kicker text-faint">
                  Signed in
                </p>
              </div>
              {session.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.avatarUrl}
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full border border-line"
                />
              ) : (
                <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-bold text-accent-ink">
                  {session.displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <a
                href="/api/auth/logout?returnTo=/hub"
                className="text-sm text-muted transition-colors hover:text-red-400"
              >
                Sign out
              </a>
            </div>
          ) : null}
        </div>
      </header>

      <main className="shell flex-1 py-10 sm:py-14">
        {!session ? (
          <SignedOut signInHref={signInHref} />
        ) : (
          <>
            <div className="mb-10">
              <h1 className="display text-4xl sm:text-5xl">
                Welcome back, {session.displayName.split(" ")[0]}.
              </h1>
              <p className="mt-3 text-sm text-muted">
                Everything your account can open, in one place.
              </p>
            </div>

            {quickLinks.length ? (
              <section className="mb-10">
                <h2 className="mb-3 text-[11px] font-bold uppercase tracking-kicker text-faint">
                  Quick links
                </h2>
                <div className="flex flex-wrap gap-2">
                  {quickLinks.map((l) => (
                    <LinkChip key={l.href} link={l} prominent />
                  ))}
                </div>
              </section>
            ) : null}

            <section>
              <h2 className="mb-3 text-[11px] font-bold uppercase tracking-kicker text-faint">
                Your areas
              </h2>

              {areas.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {areas.map((area) => (
                    <AreaCard key={area.id} area={area} />
                  ))}
                </div>
              ) : (
                <NoAreas />
              )}
            </section>
          </>
        )}
      </main>

      <PortalFooter />
    </div>
  );
}

// ---- Pieces ----------------------------------------------------------------

function AreaCard({ area }: { area: HubArea }) {
  return (
    <div className="card flex flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl uppercase">{area.name}</h3>
          <p
            className={`mt-1 text-[10px] font-bold uppercase tracking-kicker ${
              area.canWrite ? "text-accent" : "text-faint"
            }`}
          >
            {area.roleLabel}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-line px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-faint">
          {area.kind === "partner" ? "Partner" : area.kind === "company" ? "Company" : "Roster"}
        </span>
      </div>

      <p className="mt-3 text-sm text-muted">{area.blurb}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {area.links.map((l) => (
          <LinkChip key={l.href + l.label} link={l} />
        ))}
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <HubAnchor
          link={area.home}
          className="text-sm font-semibold text-accent transition-opacity hover:opacity-80"
        >
          {area.home.label} →
        </HubAnchor>
      </div>
    </div>
  );
}

function LinkChip({ link, prominent }: { link: HubLink; prominent?: boolean }) {
  return (
    <HubAnchor
      link={link}
      className={
        prominent
          ? "rounded-brand border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:border-line-strong hover:text-fg"
          : "rounded-full border border-line px-3 py-1 text-xs text-muted transition-colors hover:border-line-strong hover:text-fg"
      }
    >
      {link.label}
      {link.external ? " ↗" : ""}
    </HubAnchor>
  );
}

/**
 * A link that is a Next <Link> for same-host paths and a plain <a> for cross-host ones.
 *
 * Company lives on the main site and "View site" on a partner's own subdomain - both are
 * absolute URLs to a DIFFERENT origin, and next/link would try to client-navigate them,
 * which does not work across hosts. External links open in a new tab so the hub stays put.
 */
function HubAnchor({
  link,
  className,
  children,
}: {
  link: HubLink;
  className?: string;
  children: React.ReactNode;
}) {
  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={link.href} className={className}>
      {children}
    </Link>
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
            Sign in to see every area your account can open - SHASHA, a partner portal, the
            Company dashboard, the docs.
          </p>

          <a
            href={robloxConfigured ? signInHref : undefined}
            className={`btn mt-8 w-full ${
              robloxConfigured ? "btn-accent" : "btn-ghost pointer-events-none opacity-40"
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
        You&apos;re signed in, but your account doesn&apos;t hold access to any backstage
        area yet. Access is a rank in RO. Nation LIVE&apos;s Roblox group, or a grant from a
        partner - if you were expecting a door here, ask whoever sent you.
      </p>
      <p className="mt-3 text-xs text-faint">
        Just been promoted? Ranks can take a few minutes to take effect here.
      </p>
    </div>
  );
}

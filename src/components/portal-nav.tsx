"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * The portal header, shared by SHASHA and every partner portal.
 *
 * Every link is built from `basePath`, so the same nav serves /shasha and
 * /sleeptokenro without knowing which it is. Note these are the PUBLIC paths on
 * the portal host, not the internal /pp/<slug> routes Next actually renders —
 * see lib/partners/urls.ts.
 */
export function PortalNav({
  brand,
  basePath,
  studioLink = false,
  doorLink = false,
  keysLink = false,
  user,
}: {
  /** Wordmark in the top-left — "SHASHA", "Sleep Token RO". */
  brand: string;
  /** "/shasha" or "/<partner-slug>". */
  basePath: string;
  /**
   * Partners author their own site from here — shows, blog, careers, homepage
   * copy. SHASHA does not: RNL's content is /company's job, and SHASHA has no
   * /studio route to point at. So this is off unless a partner turns it on.
   */
  studioLink?: boolean;
  /**
   * The manual ticket check. Only for an org that HAS shows — SHASHA has none,
   * and a partner without the events feature has no tickets to check.
   */
  doorLink?: boolean;
  /**
   * API keys. Managers only — the page itself refuses read-only staff, and a nav
   * item that bounces you is worse than no nav item. Hiding it is courtesy;
   * requireScopeManager() in the page is the actual lock.
   */
  keysLink?: boolean;
  user: {
    displayName: string;
    // avatarUrl is optional: a Roblox session carries whatever picture the OAuth
    // profile had, which can be nothing. Discord always handed us a default one.
    avatarUrl?: string;
    /** Shown under the name — "Management", "Read only", "Owner". */
    roleLabel: string;
    /** Drives the accent treatment on that label. */
    canWrite: boolean;
  };
}) {
  const pathname = usePathname();

  const links = [
    { label: "Overview", href: basePath },
    ...(doorLink ? [{ label: "Door", href: `${basePath}/door` }] : []),
    ...(studioLink ? [{ label: "Studio", href: `${basePath}/studio` }] : []),
    { label: "VIP list", href: `${basePath}/vip` },
    { label: "Blacklist", href: `${basePath}/blacklist` },
    { label: "History", href: `${basePath}/audit` },
    ...(keysLink ? [{ label: "API keys", href: `${basePath}/keys` }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/85 backdrop-blur">
      <div className="shell flex h-16 items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <Link href={basePath} className="flex items-baseline gap-2">
            <span className="display text-2xl tracking-tight">{brand}</span>
            <span className="hidden text-[10px] font-bold uppercase tracking-kicker text-accent sm:inline">
              Portal
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {links.map((l) => {
              // The overview matches exactly; the rest match by prefix. Without
              // that special case, "/sleeptokenro" would light up on every page.
              const active =
                l.href === basePath
                  ? pathname === basePath
                  : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "shrink-0 px-3 py-2 text-sm font-medium transition-colors",
                    active ? "text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  {l.label}
                  {active ? (
                    <span className="mt-1 block h-px bg-accent" />
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold leading-tight">
              {user.displayName}
            </p>
            <p
              className={cn(
                "text-[10px] font-bold uppercase tracking-kicker",
                user.canWrite ? "text-accent" : "text-faint",
              )}
            >
              {user.roleLabel}
            </p>
          </div>
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-full border border-line"
            />
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-bold text-accent-ink">
              {user.displayName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <a
            href={`/api/auth/logout?returnTo=${encodeURIComponent(`${basePath}/login`)}`}
            className="text-sm text-muted transition-colors hover:text-red-400"
          >
            Sign out
          </a>
        </div>
      </div>
    </header>
  );
}

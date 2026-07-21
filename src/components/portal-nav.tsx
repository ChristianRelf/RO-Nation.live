"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SwitcherArea } from "@/lib/hub";
import { PortalSwitcher } from "@/components/portal-switcher";
import { cn } from "@/lib/utils";

/**
 * The portal header, shared by SHASHA and every partner portal.
 *
 * Every link is built from `basePath`, so the same nav serves /shasha and
 * /sleeptokenro without knowing which it is. Note these are the PUBLIC paths on
 * the portal host, not the internal /pp/<slug> routes Next actually renders -
 * see lib/partners/urls.ts.
 *
 * ---- Why dropdowns rather than a flat row --------------------------------
 *
 * An owner's portal grew to a dozen-plus items - shows, door, analytics, payouts,
 * announce, feedback, VIP, comp, blacklist, history, keys, access - and a flat row
 * of them overflowed into a horizontal scroll nobody could see the end of. So the
 * items are CATEGORISED: a couple of standalone links (Hub, Overview) and a handful
 * of grouped dropdowns. A group with only ONE visible item (a read-only staffer's
 * Insights is just Analytics) renders as a plain link, not a dropdown of one - the
 * chrome should never be heavier than what it holds.
 */
type NavItem = { label: string; href: string };
type NavGroup = { key: string; label: string; items: NavItem[] };

export function PortalNav({
  brand,
  basePath,
  studioLink = false,
  doorLink = false,
  showsLink = false,
  analyticsLink = false,
  payoutsLink = false,
  announceLink = false,
  compLink = false,
  feedbackLink = false,
  keysLink = false,
  membersLink = false,
  scopeId,
  areas = [],
  user,
}: {
  /** Wordmark in the top-left - "SHASHA", "Sleep Token". */
  brand: string;
  /** "/shasha" or "/<partner-slug>". */
  basePath: string;
  /**
   * Partners author their own site from here - shows, blog, careers, homepage
   * copy. SHASHA does not: RNL's content is /company's job, and SHASHA has no
   * /studio route to point at. So this is off unless a partner turns it on.
   */
  studioLink?: boolean;
  /**
   * The manual ticket check. Only for an org that HAS shows - a partner without
   * the events feature has no tickets to check.
   */
  doorLink?: boolean;
  /**
   * The line-up, on the portal host. SHASHA only - a partner's shows are reached
   * through Studio.
   */
  showsLink?: boolean;
  /** The read-only analytics dashboard. Only for an org that HAS shows. Every role sees it. */
  analyticsLink?: boolean;
  /** The Robux settlement statement. Managers only, and only for an org with shows. */
  payoutsLink?: boolean;
  /** Compose an announcement to a show's audience. Managers only. */
  announceLink?: boolean;
  /** Comp the VIP list into a show. Managers only. */
  compLink?: boolean;
  /** Invite a past show's attendees to a survey. Managers only, needs shows + surveys. */
  feedbackLink?: boolean;
  /** API keys. Managers only - the page itself refuses read-only staff. */
  keysLink?: boolean;
  /** Who else may sign in here. OWNERS ONLY, and only on a partner portal. */
  membersLink?: boolean;
  /**
   * Which portal this is - "shasha" or the partner slug. Only used to mark the
   * current entry in the switcher; it authorises nothing.
   */
  scopeId: string;
  /**
   * Every area this person holds, for the wordmark's switcher. Resolved server-side
   * by getPortalSwitcher(). Fewer than two and the wordmark stays a plain link.
   */
  areas?: SwitcherArea[];
  user: {
    displayName: string;
    avatarUrl?: string;
    /** Shown under the name - "Management", "Read only", "Owner". */
    roleLabel: string;
    /** Drives the accent treatment on that label. */
    canWrite: boolean;
  };
}) {
  const pathname = usePathname();

  // One open menu at a time. Closed on navigation and on any click outside the nav.
  const [open, setOpen] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(null), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // The categories. Order matters left-to-right. Empty groups are dropped, and a
  // one-item group is rendered as a plain link (see below).
  const groups: NavGroup[] = [
    {
      key: "shows",
      label: "Shows",
      items: [
        ...(showsLink ? [{ label: "Shows", href: `${basePath}/shows` }] : []),
        ...(studioLink ? [{ label: "Studio", href: `${basePath}/studio` }] : []),
        ...(doorLink ? [{ label: "Door", href: `${basePath}/door` }] : []),
      ],
    },
    {
      key: "insights",
      label: "Insights",
      items: [
        ...(analyticsLink ? [{ label: "Analytics", href: `${basePath}/analytics` }] : []),
        ...(payoutsLink ? [{ label: "Payouts", href: `${basePath}/payouts` }] : []),
      ],
    },
    {
      key: "audience",
      label: "Audience",
      items: [
        ...(announceLink ? [{ label: "Announce", href: `${basePath}/announce` }] : []),
        ...(feedbackLink ? [{ label: "Feedback", href: `${basePath}/feedback` }] : []),
      ],
    },
    {
      key: "roster",
      label: "Roster",
      items: [
        { label: "VIP list", href: `${basePath}/vip` },
        ...(compLink ? [{ label: "Comp", href: `${basePath}/comp` }] : []),
        { label: "Blacklist", href: `${basePath}/blacklist` },
      ],
    },
    {
      key: "history",
      label: "History",
      items: [{ label: "History", href: `${basePath}/audit` }],
    },
    {
      key: "settings",
      label: "Settings",
      items: [
        ...(keysLink ? [{ label: "API keys", href: `${basePath}/keys` }] : []),
        ...(membersLink ? [{ label: "Access", href: `${basePath}/members` }] : []),
      ],
    },
  ].filter((g) => g.items.length > 0);

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/85 backdrop-blur">
      <div className="shell flex h-16 items-center justify-between gap-4 sm:gap-6">
        {/* No overflow-x-auto here any more: dropdowns need overflow: visible to
            escape the header, and the whole point of grouping is that the row now
            fits. min-w-0 still lets the flex children shrink rather than push the
            page sideways. */}
        <div ref={navRef} className="flex min-w-0 items-center gap-3 sm:gap-5">
          <PortalSwitcher
            brand={brand}
            basePath={basePath}
            currentId={scopeId}
            areas={areas}
          />

          <nav className="flex min-w-0 items-center gap-0.5">
            {/* The two standalone links. Hub crosses to other portals; Overview is
                this portal's home and matches EXACTLY, or it lights up everywhere. */}
            <NavLink href="/hub" label="◈ Hub" active={pathname === "/hub"} />
            <NavLink href={basePath} label="Overview" active={pathname === basePath} />

            {groups.map((g) =>
              g.items.length === 1 ? (
                <NavLink
                  key={g.key}
                  href={g.items[0].href}
                  label={g.items[0].label}
                  active={isActive(g.items[0].href)}
                />
              ) : (
                <NavDropdown
                  key={g.key}
                  group={g}
                  isOpen={open === g.key}
                  anyActive={g.items.some((i) => isActive(i.href))}
                  onToggle={() => setOpen((cur) => (cur === g.key ? null : g.key))}
                  isActive={isActive}
                />
              ),
            )}
          </nav>
        </div>

        {/* shrink-0: who you are signed in as, and the way out. */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold leading-tight">{user.displayName}</p>
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

/** A top-level link, with the accent underline when it is the current area. */
function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "shrink-0 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors",
        active ? "text-fg" : "text-muted hover:text-fg",
      )}
    >
      {label}
      {active ? <span className="mt-1 block h-px bg-accent" /> : null}
    </Link>
  );
}

/** A category button that opens a menu of its links. */
function NavDropdown({
  group,
  isOpen,
  anyActive,
  onToggle,
  isActive,
}: {
  group: NavGroup;
  isOpen: boolean;
  anyActive: boolean;
  onToggle: () => void;
  isActive: (href: string) => boolean;
}) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={cn(
          "flex items-center gap-1 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors",
          anyActive || isOpen ? "text-fg" : "text-muted hover:text-fg",
        )}
      >
        {group.label}
        <span
          aria-hidden
          className={cn(
            "text-[10px] transition-transform",
            isOpen ? "rotate-180" : "",
          )}
        >
          ▾
        </span>
        {anyActive ? <span className="mt-1 block h-px w-full bg-accent" /> : null}
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 min-w-[10rem] overflow-hidden rounded-xl border border-line bg-elev py-1 shadow-lg"
        >
          {group.items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                className={cn(
                  "block px-4 py-2 text-sm transition-colors",
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-fg/[0.04] hover:text-fg",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

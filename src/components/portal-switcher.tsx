"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SwitcherArea } from "@/lib/hub";
import { cn } from "@/lib/utils";

/**
 * The wordmark in the portal header, as a dropdown onto every OTHER area you hold.
 *
 * PortalNav is built from a single `basePath`, so it can show you around one org
 * and no further. Somebody who works SHASHA and a partner's list had to go up to
 * /hub and back down to cross between them - three navigations to change one word
 * in the URL. This is that trip, as one click.
 *
 * The list is a VIEW of getPortalSwitcher(), which is a view of the real guards.
 * Showing a door here grants nothing: the target page runs its own guard, exactly
 * as it does when you arrive from the hub or by typing the address.
 */
export function PortalSwitcher({
  brand,
  basePath,
  currentId,
  areas,
}: {
  brand: string;
  basePath: string;
  /** "shasha", or the partner slug - whichever portal we are inside right now. */
  currentId: string;
  areas: SwitcherArea[];
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close on navigation. The portal layout persists across a client-side move, so
  // without this the menu is still hanging open over the page you just opened.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Nothing to switch to. Most people hold exactly one door, and a menu that opens
  // onto a single entry - the one you are already looking at - is worse than the
  // plain wordmark it replaced. So they keep the plain wordmark.
  if (areas.length < 2) {
    return <Wordmark brand={brand} href={basePath} />;
  }

  return (
    <div ref={wrap} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-baseline gap-2 text-left"
      >
        <span className="display text-2xl tracking-tight">{brand}</span>
        <span
          aria-hidden
          className={cn(
            "text-[10px] text-muted transition-transform",
            open && "rotate-180",
          )}
        >
          ▼
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-2 w-72 border border-line bg-bg py-1.5 shadow-xl"
        >
          <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-kicker text-faint">
            Switch area
          </p>

          {areas.map((area) => (
            <AreaRow
              key={area.id}
              area={area}
              current={area.id === currentId}
              onNavigate={() => setOpen(false)}
            />
          ))}

          <div className="mt-1.5 border-t border-line pt-1.5">
            <Link
              href="/hub"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-muted transition-colors hover:bg-line/40 hover:text-fg"
            >
              ◈ All of it, on one page
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AreaRow({
  area,
  current,
  onNavigate,
}: {
  area: SwitcherArea;
  current: boolean;
  onNavigate: () => void;
}) {
  const body = (
    <>
      <span className="flex items-center gap-2">
        <span className="truncate font-semibold">{area.name}</span>
        {current ? (
          <span aria-hidden className="text-accent">
            ●
          </span>
        ) : null}
        {area.external ? (
          <span aria-hidden className="text-faint">
            ↗
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "mt-0.5 block text-[10px] font-bold uppercase tracking-kicker",
          area.canWrite ? "text-accent" : "text-faint",
        )}
      >
        {area.roleLabel}
        {current ? " · you are here" : ""}
      </span>
    </>
  );

  const className = cn(
    "block px-3 py-2 text-sm transition-colors hover:bg-line/40",
    current && "bg-line/25",
  );

  // Company lives on the main site: a different origin, which next/link cannot
  // client-navigate. Same split as the hub's HubAnchor - except these do NOT open
  // in a new tab, because switching area means going there, not opening a copy.
  if (area.external) {
    return (
      <a href={area.href} role="menuitem" onClick={onNavigate} className={className}>
        {body}
      </a>
    );
  }

  return (
    <Link href={area.href} role="menuitem" onClick={onNavigate} className={className}>
      {body}
    </Link>
  );
}

function Wordmark({ brand, href }: { brand: string; href: string }) {
  return (
    <Link href={href} className="flex shrink-0 items-baseline gap-2">
      <span className="display text-2xl tracking-tight">{brand}</span>
      <span className="hidden text-[10px] font-bold uppercase tracking-kicker text-accent sm:inline">
        Portal
      </span>
    </Link>
  );
}

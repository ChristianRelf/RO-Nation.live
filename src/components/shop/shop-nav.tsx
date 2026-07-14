"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Hook } from "./furniture";

// The rails, in the header.
//
// A client component, and it earns it: without usePathname there is no way to show which
// rail you are standing at, and a shop nav that never marks where you are is a shop nav
// that makes you re-read it on every page. It costs about a kilobyte.
//
// The paths here are PUBLIC ones (/sleeptoken) - the middleware rewrites them onto /merch
// internally, but usePathname reports what the browser is on, so they compare directly.

export function ShopNav({
  items,
}: {
  items: { slug: string; name: string; href: string }[];
}) {
  const pathname = usePathname();

  return (
    <nav className="flex items-stretch gap-1 overflow-x-auto">
      {items.map((c, i) => {
        // startsWith, not ===, so a product page keeps its rail lit up.
        const active = pathname === c.href || pathname.startsWith(`${c.href}/`);

        return (
          <Link
            key={c.slug}
            href={c.href}
            aria-current={active ? "page" : undefined}
            className="group relative flex shrink-0 flex-col items-center justify-end px-3 pb-2 pt-1"
          >
            {/* It hangs off the bar below, like everything else in this shop. The hook is
                always in the DOM - only its opacity changes - so nothing shifts when it
                appears. */}
            <Hook
              className={cn(
                "h-3 w-3 transition-opacity duration-200",
                active
                  ? "text-accent opacity-100"
                  : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
              )}
            />
            <span className="mt-0.5 flex items-baseline gap-1.5 whitespace-nowrap">
              <span
                className={cn(
                  "font-mono text-[9px] tabular-nums transition-colors",
                  active ? "text-accent" : "text-faint",
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={cn(
                  "text-[11px] font-bold uppercase tracking-[0.14em] transition-colors",
                  active ? "text-fg" : "text-muted group-hover:text-fg",
                )}
              >
                {c.name}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

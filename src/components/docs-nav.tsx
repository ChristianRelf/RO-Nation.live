"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * The docs sidebar. A sibling of CompanyNav rather than a reuse of PortalNav,
 * whose links are hard-wired to a roster (VIP, blacklist, history) - the docs
 * have nothing in common with that shape.
 */
export function DocsNav({ showApi }: { showApi: boolean }) {
  const pathname = usePathname();

  const links = [
    { label: "Overview", href: "/docs" },
    { label: "Guides", href: "/docs/guides" },
    { label: "Runbooks", href: "/docs/runbooks" },
    { label: "Onboarding", href: "/docs/onboarding" },
    { label: "Brand assets", href: "/docs/brandassets" },
    { label: "Templates", href: "/docs/templates" },
    // Only for somebody who could actually hold a key. Hiding it is courtesy -
    // requireDocsUser() on the page is the lock. See lib/docs-guard.ts.
    ...(showApi ? [{ label: "Ticket API", href: "/docs/api" }] : []),
  ];

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <nav className="flex gap-1 overflow-x-auto lg:flex-col">
        {links.map((l) => {
          // The overview matches exactly; the rest by prefix. Without the special
          // case, "/docs" would light up on every page under it.
          const active =
            l.href === "/docs"
              ? pathname === "/docs"
              : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-surface text-fg"
                  : "text-muted hover:bg-surface/60 hover:text-fg",
              )}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

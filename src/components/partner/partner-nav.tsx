"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// The partner area's tabs. A sibling of DocsNav rather than a reuse of PortalNav (whose
// links are hard-wired to a roster), and horizontal because the area has two or three
// tabs, not a sidebar's worth. "Accounting" is only shown to a full partner - hiding it
// is courtesy; the page guard (isFullPartner) is the lock.
export function PartnerNav({ showAccounting }: { showAccounting: boolean }) {
  const pathname = usePathname();

  const links = [
    { label: "Overview", href: "/partner" },
    { label: "Documents", href: "/partner/documents" },
    ...(showAccounting ? [{ label: "Accounting", href: "/partner/accounting" }] : []),
  ];

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {links.map((l) => {
        // Overview matches exactly; the rest by prefix, or "/partner" would light up everywhere.
        const active =
          l.href === "/partner" ? pathname === "/partner" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
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
  );
}

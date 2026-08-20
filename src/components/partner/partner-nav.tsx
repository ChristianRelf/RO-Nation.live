"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// The partner area's tabs. A sibling of DocsNav rather than a reuse of PortalNav (whose
// links are hard-wired to a roster), and horizontal because the area has two or three
// tabs, not a sidebar's worth. "Payments" is only shown to a full partner - hiding it
// is courtesy; the page guard (isFullPartner) is the lock.
//
// That tab now leaves the host: the partner's ledger lives on pay.ronation.live, and
// /hub/accounting is a redirect to it. Pointing the tab straight at the destination
// saves a hop AND means it can never light up as "active" against a path that no longer
// renders anything - which is why `out` links skip the active check entirely.
export function PartnerNav({
  showAccounting,
  payHref,
}: {
  showAccounting: boolean;
  /**
   * https://pay.ronation.live - resolved by PartnerShell, on the SERVER.
   *
   * Not derived here, because this is a "use client" module: Next inlines
   * NEXT_PUBLIC_SITE_URL into the client bundle at BUILD time, and the image is built
   * without it, so anything derived from it up here becomes localhost the instant React
   * hydrates. Same trap, same fix, as CompanyNav - see the long note on groupsFor() there.
   */
  payHref: string;
}) {
  const pathname = usePathname();

  const links: { label: string; href: string; out?: boolean }[] = [
    { label: "Overview", href: "/hub" },
    { label: "Documents", href: "/hub/documents" },
    ...(showAccounting ? [{ label: "Payments", href: payHref, out: true }] : []),
  ];

  const className = (active: boolean) =>
    cn(
      "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
      active ? "bg-surface text-fg" : "text-muted hover:bg-surface/60 hover:text-fg",
    );

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {links.map((l) =>
        // A plain <a> for the cross-host one. A <Link> would fire a client RSC fetch that
        // the middleware answers with a redirect the browser cannot follow cross-origin.
        l.out ? (
          <a key={l.href} href={l.href} className={className(false)}>
            {l.label} ↗
          </a>
        ) : (
          <Link
            key={l.href}
            href={l.href}
            aria-current={
              // Overview matches exactly; the rest by prefix, or "/hub" would light
              // up everywhere.
              (l.href === "/hub"
                ? pathname === "/hub"
                : pathname.startsWith(l.href))
                ? "page"
                : undefined
            }
            className={className(
              l.href === "/hub"
                ? pathname === "/hub"
                : pathname.startsWith(l.href),
            )}
          >
            {l.label}
          </Link>
        ),
      )}
    </nav>
  );
}

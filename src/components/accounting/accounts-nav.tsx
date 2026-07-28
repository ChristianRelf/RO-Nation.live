"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// The nav for accounts.ronation.live.
//
// ---- Why this is not CompanyNav -------------------------------------------
//
// The accounting desk used to live at ronation.live/company/accounting and wear the
// company sidebar. It does not any more: it is a portal on its own host, and every link
// in that sidebar is a path on ANOTHER one. `<Link href="/company/events">` rendered here
// resolves against accounts.ronation.live, the middleware rewrites it to
// /accounts/company/events, and it 404s - a whole sidebar of dead links, each of which
// looks perfectly fine until somebody clicks it.
//
// So the links below are the paths THIS host actually serves, and the handful that leave
// it are absolute and come from lib/accounting/urls.ts. That split is the rule for both
// halves of the payment system.
//
// ---- Why the paths look bare ----------------------------------------------
//
// "/" is the desk, "/books" is the books, "/<id>" is a document. No prefix, because the
// prefix is the hostname. The internal /accounts/… paths these rewrite to are not URLs
// anybody types and never appear in an href - see src/middleware.ts.

type NavLink = { label: string; href: string; badge?: number };

export function AccountsNav({
  user,
  openRequests,
}: {
  user: { displayName: string; roleName: string; rank: number };
  /** Requests waiting on somebody. Rendered as a count, omitted when zero. */
  openRequests: number;
}) {
  const pathname = usePathname();

  const links: NavLink[] = [
    { label: "Desk", href: "/" },
    { label: "Books", href: "/books" },
    // The badge is the whole reason requests are a nav item rather than a card on the
    // desk. A queue you have to remember to go and look at is a queue that grows.
    { label: "Requests", href: "/requests", badge: openRequests || undefined },
    { label: "Refund a ticket", href: "/refund" },
  ];

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="mb-6">
        <p className="font-display text-2xl uppercase">Accounts</p>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-kicker text-accent">
          {user.roleName} · rank {user.rank}
        </p>
      </div>

      {/* On a narrow screen this collapses into one scrolling row, exactly as the
          company sidebar does - four links is a row, not a column, on a phone. */}
      <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0">
        {links.map((l) => {
          // The desk matches exactly; everything else by prefix, or "/" would light up on
          // every page. Same rule CompanyNav uses for "/company" and PartnerNav for
          // "/partner", and it is load-bearing in exactly one place here: a document page
          // is "/<id>", which must NOT light up "/books".
          const active =
            l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:block",
                active
                  ? "bg-surface text-fg"
                  : "text-muted hover:bg-surface/60 hover:text-fg",
              )}
            >
              <span className="lg:inline">{l.label}</span>
              {l.badge ? (
                <span className="ml-2 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent ring-1 ring-inset ring-accent/30">
                  {l.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

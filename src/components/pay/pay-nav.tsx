"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// The tabs on pay.ronation.live.
//
// Bare paths, because the prefix is the hostname - the internal /pay/… these rewrite to is
// not a URL anybody types and must never appear in an href. Same rule as AccountsNav; see
// the note at the top of that file for what happens when a nav is borrowed across hosts.
//
// Four tabs, and the order is the order somebody arrives in: what is my position, what are
// the documents behind it, and then the two things I might want to do about it.
export function PayNav({ openRequests }: { openRequests: number }) {
  const pathname = usePathname();

  const links = [
    { label: "Overview", href: "/" },
    { label: "Statements", href: "/statements" },
    { label: "Pay us", href: "/make-payment" },
    { label: "Request a payment", href: "/request-payment" },
    {
      label: "Your requests",
      href: "/requests",
      badge: openRequests || undefined,
    },
  ];

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {links.map((l) => {
        // Overview matches exactly; the rest by prefix, or "/" would light up everywhere.
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-surface text-fg"
                : "text-muted hover:bg-surface/60 hover:text-fg",
            )}
          >
            {l.label}
            {l.badge ? (
              <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent ring-1 ring-inset ring-accent/30">
                {l.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

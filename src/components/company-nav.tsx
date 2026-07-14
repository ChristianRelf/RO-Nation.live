"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// The Company sidebar. Everything on ronation.live is authored from behind these
// six links - the /admin dashboard that used to hold the last three is gone.
const links = [
  { label: "Overview", href: "/company" },
  { label: "Events", href: "/company/events" },
  { label: "Door", href: "/company/door" },
  { label: "Blog", href: "/company/blog" },
  { label: "Merch", href: "/company/merch" },
  { label: "Docs", href: "/company/docs" },
  { label: "Surveys", href: "/company/surveys" },
  { label: "Careers", href: "/company/careers" },
  { label: "Applications", href: "/company/applications" },
];

export function CompanyNav({
  user,
}: {
  user: { displayName: string; roleName: string; rank: number };
}) {
  const pathname = usePathname();

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="mb-6">
        <p className="font-display text-2xl uppercase">Company</p>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-kicker text-accent">
          {user.roleName} · rank {user.rank}
        </p>
      </div>

      <nav className="flex gap-1 overflow-x-auto lg:flex-col">
        {links.map((l) => {
          const active =
            l.href === "/company"
              ? pathname === "/company"
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

      <div className="mt-6 flex flex-col gap-1 border-t border-line pt-4">
        <Link
          href="/company/settings"
          className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-fg"
        >
          Settings
        </Link>
        <Link
          href="/"
          className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-fg"
        >
          View site ↗
        </Link>
        <a
          href="/api/auth/logout"
          className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-red-400"
        >
          Sign out
        </a>
      </div>
    </aside>
  );
}

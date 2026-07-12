"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./logo";
import { adminLogout } from "@/app/actions/admin";
import { cn } from "@/lib/utils";

const links = [
  { label: "Overview", href: "/admin" },
  { label: "Events", href: "/admin/events" },
  { label: "Careers", href: "/admin/careers" },
  { label: "Applications", href: "/admin/applications" },
  { label: "Settings", href: "/admin/settings" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="mb-6">
        <Logo href="/admin" />
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-kicker text-accent">
          Control room
        </p>
      </div>

      <nav className="flex gap-1 overflow-x-auto lg:flex-col">
        {links.map((l) => {
          const active =
            l.href === "/admin"
              ? pathname === "/admin"
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
          href="/"
          className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-fg"
        >
          View site ↗
        </Link>
        <form action={adminLogout}>
          <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors hover:text-red-400">
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}

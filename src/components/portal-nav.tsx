"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { label: "Overview", href: "/shasha" },
  { label: "VIP list", href: "/shasha/vip" },
  { label: "Blacklist", href: "/shasha/blacklist" },
  { label: "History", href: "/shasha/audit" },
];

export function PortalNav({
  user,
}: {
  // avatarUrl is optional: a Roblox session carries whatever picture the OAuth
  // profile had, which can be nothing. Discord always handed us a default one.
  user: { displayName: string; avatarUrl?: string; role: "manager" | "staff" };
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/85 backdrop-blur">
      <div className="shell flex h-16 items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <Link href="/shasha" className="flex items-baseline gap-2">
            <span className="display text-2xl tracking-tight">SHASHA</span>
            <span className="hidden text-[10px] font-bold uppercase tracking-kicker text-accent sm:inline">
              Portal
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {links.map((l) => {
              const active =
                l.href === "/shasha"
                  ? pathname === "/shasha"
                  : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "shrink-0 px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "text-fg"
                      : "text-muted hover:text-fg",
                  )}
                >
                  {l.label}
                  {active ? (
                    <span className="mt-1 block h-px bg-accent" />
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold leading-tight">
              {user.displayName}
            </p>
            <p
              className={cn(
                "text-[10px] font-bold uppercase tracking-kicker",
                user.role === "manager" ? "text-accent" : "text-faint",
              )}
            >
              {user.role === "manager" ? "Management" : "Read only"}
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
            href="/api/auth/logout?returnTo=/shasha/login"
            className="text-sm text-muted transition-colors hover:text-red-400"
          >
            Sign out
          </a>
        </div>
      </div>
    </header>
  );
}

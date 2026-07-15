"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./logo";
import { nav } from "@/lib/site";
import { cn } from "@/lib/utils";

type Account = {
  displayName: string;
  username: string;
  avatarUrl: string | null;
} | null;

export function HeaderClient({
  account,
  canCompany,
}: {
  account: Account;
  /**
   * Signed in with Roblox and ranked high enough in the group for /company.
   *
   * Presentation only. The link is a convenience, not a permission - /company
   * re-reads the rank on every page and every write.
   */
  canCompany: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-300 supports-[backdrop-filter]:bg-bg/70",
        scrolled
          ? "border-b border-line bg-bg/85 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.9)]"
          : "border-b border-transparent bg-bg/90",
      )}
    >
      <div className="shell flex h-16 items-center justify-between gap-4">
        <Logo />

        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((item) => {
            const active = pathname.startsWith(item.href);
            const className = cn(
              "link-underline text-sm font-medium transition-colors",
              active ? "text-fg" : "text-muted hover:text-fg",
            );
            // A cross-host link (Merch) hard-navigates - a <Link> would try a
            // client RSC fetch that the middleware redirects off-origin. See NavItem.
            return item.hardNav ? (
              <a key={item.href} href={item.href} className={className}>
                {item.label}
              </a>
            ) : (
              <Link key={item.href} href={item.href} className={className}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 md:flex">
            {account ? (
              <AccountMenu account={account} canCompany={canCompany} />
            ) : (
              <>
                <Link
                  href="/account"
                  className="text-sm font-medium text-muted transition-colors hover:text-fg"
                >
                  Sign in
                </Link>
                <Link href="/events" className="btn btn-accent !py-2.5 !px-5">
                  Get tickets
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-lg border border-line md:hidden"
          >
            <span className="relative block h-3.5 w-5">
              <span
                className={cn(
                  "absolute left-0 h-0.5 w-5 bg-fg transition-all",
                  open ? "top-1.5 rotate-45" : "top-0",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 top-1.5 h-0.5 w-5 bg-fg transition-all",
                  open && "opacity-0",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 h-0.5 w-5 bg-fg transition-all",
                  open ? "top-1.5 -rotate-45" : "top-3",
                )}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          "overflow-hidden border-line bg-elev md:hidden",
          open ? "border-b" : "pointer-events-none",
        )}
        style={{ maxHeight: open ? 460 : 0, transition: "max-height .35s ease" }}
      >
        <div className="shell flex flex-col gap-1 py-4">
          {nav.map((item) => {
            const className =
              "rounded-lg px-3 py-3 text-base font-medium text-fg hover:bg-surface";
            return item.hardNav ? (
              <a key={item.href} href={item.href} className={className}>
                {item.label}
              </a>
            ) : (
              <Link key={item.href} href={item.href} className={className}>
                {item.label}
              </Link>
            );
          })}
          <div className="my-2 h-px bg-line" />
          {account ? (
            <>
              <Link
                href="/tickets"
                className="rounded-lg px-3 py-3 text-base font-medium text-fg hover:bg-surface"
              >
                My tickets
              </Link>
              {canCompany && (
                <Link
                  href="/company"
                  className="rounded-lg px-3 py-3 text-base font-medium text-fg hover:bg-surface"
                >
                  Company
                </Link>
              )}
              <a
                href="/api/auth/logout"
                className="rounded-lg px-3 py-3 text-base font-medium text-muted hover:bg-surface"
              >
                Sign out
              </a>
            </>
          ) : (
            <Link href="/account" className="btn btn-accent mt-1 w-full">
              Sign in with Roblox
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function AccountMenu({
  account,
  canCompany,
}: {
  account: NonNullable<Account>;
  canCompany: boolean;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = () => setOpen(false);
    if (open) {
      window.addEventListener("click", close);
      return () => window.removeEventListener("click", close);
    }
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 transition-colors hover:border-line-strong"
      >
        <Avatar account={account} />
        <span className="max-w-[110px] truncate text-sm font-medium">
          {account.displayName}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-12 w-52 overflow-hidden rounded-2xl border border-line bg-elev p-1.5 shadow-2xl shadow-black/50">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold">{account.displayName}</p>
            <p className="truncate text-xs text-muted">@{account.username}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link
            href="/tickets"
            className="block rounded-lg px-3 py-2 text-sm hover:bg-surface"
          >
            My tickets
          </Link>
          {canCompany && (
            <Link
              href="/company"
              className="block rounded-lg px-3 py-2 text-sm hover:bg-surface"
            >
              Company
            </Link>
          )}
          <a
            href="/api/auth/logout"
            className="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface"
          >
            Sign out
          </a>
        </div>
      )}
    </div>
  );
}

function Avatar({ account }: { account: NonNullable<Account> }) {
  if (account.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={account.avatarUrl}
        alt=""
        className="h-8 w-8 rounded-full border border-line object-cover"
      />
    );
  }
  return (
    <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-bold text-accent-ink">
      {account.displayName.charAt(0).toUpperCase()}
    </span>
  );
}

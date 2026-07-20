"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Prev/next paging that keeps `?page=` in the URL, exactly like RosterSearch
 * keeps `?q=` there - so a page is shareable, survives a refresh, and the server
 * does the slicing.
 *
 * It renders nothing at all when everything fits on one page. Paging chrome
 * under a list of six people is noise that reads as "there is more here".
 */
export function RosterPagination({
  page,
  pageCount,
}: {
  /** 1-based, already clamped by the caller. */
  page: number;
  pageCount: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pageCount <= 1) return null;

  function href(next: number) {
    const params = new URLSearchParams(searchParams);
    // Page 1 is the bare URL - no ?page=1 clutter on the common case.
    if (next <= 1) params.delete("page");
    else params.set("page", String(next));
    // A result banner belongs to the write that caused it, not to wherever you
    // page to next. Same reasoning as RosterSearch.
    params.delete("ok");
    params.delete("error");

    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  return (
    <nav
      className="flex items-center justify-between gap-4 border-t border-line pt-4"
      aria-label="Pagination"
    >
      <Step href={href(page - 1)} disabled={page <= 1}>
        ← Previous
      </Step>

      <p className="tnum text-xs text-faint">
        Page {page} of {pageCount}
      </p>

      <Step href={href(page + 1)} disabled={page >= pageCount}>
        Next →
      </Step>
    </nav>
  );
}

function Step({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const className = cn(
    "rounded-brand border border-line px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors",
    disabled
      ? "pointer-events-none opacity-30"
      : "text-muted hover:border-line-strong hover:text-fg",
  );

  // A disabled step is a <span>, not a dead <Link>: there is no destination, so
  // there should be no link for a keyboard or a screen reader to land on.
  if (disabled) {
    return (
      <span className={className} aria-disabled>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} scroll={false} className={className}>
      {children}
    </Link>
  );
}

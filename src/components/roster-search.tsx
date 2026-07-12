"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Search box that keeps `?q=` in the URL — so results are shareable, survive a
 * refresh, and the server does the filtering.
 */
export function RosterSearch({
  placeholder = "Search by Roblox username, ID, role or reason…",
  autoFocus,
}: {
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const initial = searchParams.get("q") ?? "";
  const [value, setValue] = useState(initial);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  // Keep in step when the query changes from elsewhere (e.g. a "clear" link).
  useEffect(() => setValue(initial), [initial]);

  function push(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next.trim()) params.set("q", next.trim());
    else params.delete("q");
    // Result banners shouldn't outlive the search that follows them.
    params.delete("ok");
    params.delete("error");

    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    });
  }

  function onChange(next: string) {
    setValue(next);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => push(next), 250);
  }

  return (
    <div className="relative">
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            clearTimeout(debounce.current);
            push(value);
          }
          if (e.key === "Escape") {
            clearTimeout(debounce.current);
            setValue("");
            push("");
          }
        }}
        placeholder={placeholder}
        aria-label="Search the list"
        className="w-full border border-line bg-bg py-3 pl-11 pr-24 text-sm outline-none transition-colors focus:border-accent"
      />

      <span
        aria-hidden
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
      >
        ⌕
      </span>

      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
        {pending ? (
          <span className="text-[10px] font-bold uppercase tracking-kicker text-faint">
            …
          </span>
        ) : null}
        {value ? (
          <button
            type="button"
            onClick={() => {
              clearTimeout(debounce.current);
              setValue("");
              push("");
            }}
            className="text-[10px] font-bold uppercase tracking-kicker text-muted hover:text-fg"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

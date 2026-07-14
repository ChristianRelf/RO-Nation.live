"use client";

import { useEffect, useRef, useState } from "react";
import type { RobloxProfile } from "@/lib/roblox-users";

// Find a real Roblox account, rather than typing a name and hoping.
//
// ---- Why it takes `search` as a prop --------------------------------------
//
// This was born inside roster-add-form.tsx, wired directly to searchRoblox(scope, q) -
// the portal's action, guarded by requireScopeUser(), whose scopes are "shasha" or a
// partner slug.
//
// /company needed the same picker, and calling that action from there WOULD HAVE WORKED,
// today, by coincidence: a /company user holds rank >= COMPANY_MIN_RANK (245), which
// happens to clear SHASHA_MIN_RANK (200). But those are two separate environment
// variables describing two separate doors. Set them apart - which is the entire reason
// they are separate variables - and the picker inside /company would silently start
// redirecting to /shasha/login, from a page the user is perfectly entitled to be on.
//
// So the component does not know about scopes at all. It is handed a function that
// returns Roblox profiles, and each caller passes the one whose guard matches the door
// the user came through. Nobody borrows anybody else's permission.
//
// The picked profile is a CONVENIENCE, never evidence: every action that receives one
// re-resolves the id against Roblox server-side before it writes. See addRosterEntry.

export function RobloxPicker({
  search,
  onPick,
  placeholder = "Roblox username or user ID",
}: {
  /** Runs the lookup. Supply the action whose guard matches this page. */
  search: (query: string) => Promise<RobloxProfile[]>;
  onPick: (profile: RobloxProfile) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RobloxProfile[]>([]);
  const [searched, setSearched] = useState(false);
  const [pending, setPending] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef(0);

  useEffect(() => () => clearTimeout(debounce.current), []);

  async function run(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setSearched(false);
      return;
    }

    const ticket = ++latest.current;
    setPending(true);
    try {
      const found = await search(trimmed);
      // Ignore a slow response that a newer keystroke has already superseded.
      if (ticket !== latest.current) return;
      setResults(found);
      setSearched(true);
    } finally {
      if (ticket === latest.current) setPending(false);
    }
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          clearTimeout(debounce.current);
          debounce.current = setTimeout(() => run(e.target.value), 300);
        }}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full border border-line bg-bg px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
      />

      {pending ? <p className="mt-2 text-xs text-faint">Searching Roblox…</p> : null}

      {!pending && searched && !results.length ? (
        <p className="mt-2 text-xs text-faint">
          No Roblox account matched “{query.trim()}”.
        </p>
      ) : null}

      {results.length ? (
        <ul className="mt-2 divide-y divide-line border border-line">
          {results.map((r) => (
            <li key={r.robloxId}>
              <button
                type="button"
                onClick={() => onPick(r)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface"
              >
                <RobloxAvatar src={r.avatarUrl} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {r.displayName}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    @{r.username} · {r.robloxId}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** The chosen account, with a way out of it. */
export function PickedUser({
  profile,
  onClear,
}: {
  profile: RobloxProfile;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border border-accent/40 bg-accent-soft px-3 py-2.5">
      <RobloxAvatar src={profile.avatarUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{profile.displayName}</p>
        <p className="truncate text-xs text-muted">
          @{profile.username} · {profile.robloxId}
        </p>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="text-[10px] font-bold uppercase tracking-kicker text-muted hover:text-fg"
      >
        Change
      </button>
    </div>
  );
}

/**
 * A Roblox headshot.
 *
 * Tolerates null and tolerates a 404, because these URLs rotate - the same rule
 * MerchProduct.thumbnailUrl lives under. The empty square is the design, not an error.
 */
export function RobloxAvatar({
  src,
  size = 36,
}: {
  src: string | null;
  size?: number;
}) {
  const box = { width: size, height: size };

  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      style={box}
      className="shrink-0 border border-line bg-bg object-cover"
    />
  ) : (
    <span style={box} className="shrink-0 border border-line bg-bg" />
  );
}

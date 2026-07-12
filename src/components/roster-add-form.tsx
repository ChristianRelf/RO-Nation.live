"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { RosterKind } from "@prisma/client";
import { addRosterEntry, searchRoblox } from "@/app/actions/portal";
import type { RobloxProfile } from "@/lib/roblox-users";
import { cn } from "@/lib/utils";

/**
 * Add-to-list form. The Roblox user is picked from a live lookup rather than
 * typed free-hand, so an entry can't end up pinned to a misspelled name — the
 * server re-resolves the id on submit regardless.
 *
 * `scope` says which org's list this is (see lib/portal-scope.ts). It travels as
 * a hidden field, which is safe: the action does not trust it for authorization,
 * it re-runs that org's guard against the caller's session.
 */
export function RosterAddForm({
  scope,
  kind,
}: {
  scope: string;
  kind: RosterKind;
}) {
  const isVip = kind === "VIP";
  const [picked, setPicked] = useState<RobloxProfile | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={addRosterEntry}
      className="card p-6"
      onSubmit={() => {
        // Reset once the action has taken the data; the redirect re-renders anyway.
        setTimeout(() => {
          setPicked(null);
          setTags([]);
          formRef.current?.reset();
        }, 0);
      }}
    >
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="robloxId" value={picked?.robloxId ?? ""} />
      <input type="hidden" name="tags" value={tags.join(",")} />

      <h2 className="font-display text-xl uppercase">
        {isVip ? "Add a VIP" : "Blacklist someone"}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {isVip
          ? "Search Roblox, pick the right account, then say why they're on the list."
          : "Search Roblox, pick the right account, then record the reason for the ban."}
      </p>

      <div className="mt-5 space-y-4">
        <Field label="Roblox account">
          {picked ? (
            <PickedUser profile={picked} onClear={() => setPicked(null)} />
          ) : (
            <RobloxPicker scope={scope} onPick={setPicked} />
          )}
        </Field>

        <Field
          label={isVip ? "Roles" : "Tags"}
          hint={
            isVip
              ? "e.g. vip+, artist, partner — press Enter after each"
              : "e.g. exploiting, harassment — press Enter after each"
          }
        >
          <TagInput tags={tags} onChange={setTags} />
        </Field>

        <Field label="Reason" hint="Required — kept in the history log.">
          <textarea
            name="reason"
            required
            rows={3}
            maxLength={2000}
            placeholder={
              isVip
                ? "Why do they get VIP access?"
                : "What did they do, and where?"
            }
            className="w-full resize-y border border-line bg-bg px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
          />
        </Field>
      </div>

      <SubmitButton disabled={!picked} kind={kind} />
    </form>
  );
}

function SubmitButton({
  disabled,
  kind,
}: {
  disabled: boolean;
  kind: RosterKind;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={disabled || pending}
      className={cn(
        "btn btn-accent mt-6 w-full",
        (disabled || pending) && "pointer-events-none opacity-40",
      )}
    >
      {pending
        ? "Saving…"
        : kind === "VIP"
          ? "Add to VIP list"
          : "Add to blacklist"}
    </button>
  );
}

// ---- Roblox typeahead --------------------------------------------
function RobloxPicker({
  scope,
  onPick,
}: {
  scope: string;
  onPick: (p: RobloxProfile) => void;
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
      const found = await searchRoblox(scope, trimmed);
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
        placeholder="Roblox username or user ID"
        autoComplete="off"
        className="w-full border border-line bg-bg px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
      />

      {pending ? (
        <p className="mt-2 text-xs text-faint">Searching Roblox…</p>
      ) : null}

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
                <Avatar src={r.avatarUrl} />
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

function PickedUser({
  profile,
  onClear,
}: {
  profile: RobloxProfile;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border border-accent/40 bg-accent-soft px-3 py-2.5">
      <Avatar src={profile.avatarUrl} />
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

function Avatar({ src }: { src: string | null }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={36}
      height={36}
      className="h-9 w-9 shrink-0 border border-line bg-bg object-cover"
    />
  ) : (
    <span className="h-9 w-9 shrink-0 border border-line bg-bg" />
  );
}

// ---- Tags ---------------------------------------------------------
function TagInput({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const tag = raw.trim().replace(/,/g, "").slice(0, 24);
    setDraft("");
    if (!tag || tags.length >= 8) return;
    if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    onChange([...tags, tag]);
  }

  return (
    <div className="border border-line bg-bg px-2 py-2 focus-within:border-accent">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="pill !text-fg">
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              aria-label={`Remove ${tag}`}
              className="text-faint hover:text-red-400"
            >
              ×
            </button>
          </span>
        ))}

        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit(draft);
            } else if (e.key === "Backspace" && !draft && tags.length) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={() => commit(draft)}
          placeholder={tags.length >= 8 ? "Max 8" : "Add a role…"}
          disabled={tags.length >= 8}
          className="min-w-[8rem] flex-1 bg-transparent px-2 py-1 text-sm outline-none"
        />
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

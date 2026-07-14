"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { RosterKind } from "@prisma/client";
import { addRosterEntry, searchRoblox } from "@/app/actions/portal";
import { PickedUser, RobloxPicker } from "@/components/roblox-picker";
import type { RobloxProfile } from "@/lib/roblox-users";
import { cn } from "@/lib/utils";

/**
 * Add-to-list form. The Roblox user is picked from a live lookup rather than
 * typed free-hand, so an entry can't end up pinned to a misspelled name - the
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
            // The scope is bound in HERE, at the call site, rather than being a prop of
            // the picker - so this page can only ever search through the guard that
            // matches the door its user came through. See the note in roblox-picker.tsx.
            <RobloxPicker
              search={(q) => searchRoblox(scope, q)}
              onPick={setPicked}
            />
          )}
        </Field>

        <Field
          label={isVip ? "Roles" : "Tags"}
          hint={
            isVip
              ? "e.g. vip+, artist, partner - press Enter after each"
              : "e.g. exploiting, harassment - press Enter after each"
          }
        >
          <TagInput tags={tags} onChange={setTags} />
        </Field>

        <Field label="Reason" hint="Required - kept in the history log.">
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

// The Roblox typeahead, the picked-user card and the avatar all used to live here as
// private components. They are in components/roblox-picker.tsx now, because /company/team
// needs the identical thing and the alternative was a second copy that would drift.

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

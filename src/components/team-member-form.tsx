"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import type { TeamMember } from "@prisma/client";
import {
  createTeamMember,
  searchRobloxForCompany,
  updateTeamMember,
} from "@/app/actions/company";
import { PickedUser, RobloxAvatar, RobloxPicker } from "@/components/roblox-picker";
import type { RobloxProfile } from "@/lib/roblox-users";
import { cn } from "@/lib/utils";

// Adding somebody to the crew.
//
// The Roblox account is PICKED, never typed - and on an edit it cannot be changed at all.
// That is the whole design. /team used to be six invented people with invented handles;
// making the identity come back from Roblox's own API means the worst you can do now is
// add the wrong real person, which is a mistake somebody notices, rather than a person
// who does not exist, which is a mistake nobody notices for a year.
//
// The server re-resolves the id regardless (see createTeamMember) - the profile below is
// a convenience for the person filling the form in, never evidence.

export function TeamMemberForm({ member }: { member?: TeamMember }) {
  const editing = Boolean(member);
  const [picked, setPicked] = useState<RobloxProfile | null>(null);

  return (
    <form
      action={editing ? updateTeamMember : createTeamMember}
      className="card space-y-5 p-6"
    >
      {member ? <input type="hidden" name="id" value={member.id} /> : null}
      {!editing ? (
        <input type="hidden" name="robloxId" value={picked?.robloxId ?? ""} />
      ) : null}

      <Field
        label="Roblox account"
        hint={
          editing
            ? "Locked. A card IS a Roblox account - to point it at somebody else, remove this one and add them."
            : "Search Roblox and pick the right account. The name and picture come from Roblox, not from here."
        }
      >
        {editing ? (
          <div className="flex items-center gap-3 border border-line bg-bg px-3 py-2.5">
            <RobloxAvatar src={member!.avatarUrl} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {member!.displayName}
              </p>
              <p className="truncate text-xs text-muted">
                @{member!.robloxUsername} · {member!.robloxId}
              </p>
            </div>
          </div>
        ) : picked ? (
          <PickedUser profile={picked} onClear={() => setPicked(null)} />
        ) : (
          // Bound to the /company guard here at the call site, never to the portal's -
          // see the note in components/roblox-picker.tsx.
          <RobloxPicker search={searchRobloxForCompany} onPick={setPicked} />
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Role" hint="Their job. Shown under their name.">
          <Input
            name="role"
            required
            defaultValue={member?.role}
            placeholder="Lead Stage Builder"
          />
        </Field>

        <Field label="Department" hint="Groups the cards on /team.">
          <Input
            name="department"
            defaultValue={member?.department ?? "Crew"}
            placeholder="Build"
          />
        </Field>
      </div>

      <Field
        label="Bio"
        hint="Optional. A name and a role is already a complete card - leave it empty rather than padding it out."
      >
        <textarea
          name="bio"
          rows={3}
          maxLength={400}
          defaultValue={member?.bio ?? ""}
          className="w-full resize-y border border-line bg-bg px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Order" hint="Lower sorts first, within a department.">
          <Input
            type="number"
            name="order"
            defaultValue={String(member?.order ?? 0)}
            className="w-28"
          />
        </Field>

        <Field label="On the site">
          <label className="flex items-center gap-2.5 py-2.5 text-sm text-muted">
            <input
              type="checkbox"
              name="visible"
              defaultChecked={member ? member.visible : true}
              className="h-4 w-4 accent-accent"
            />
            Show on /team
          </label>
          <p className="mt-1 text-xs text-faint">
            Unticking hides the card and keeps the person. Somebody who steps back
            for a season comes back with their blurb intact.
          </p>
        </Field>
      </div>

      <div className="flex items-center gap-3 border-t border-line pt-5">
        <Submit disabled={!editing && !picked} editing={editing} />
        <Link href="/company/team" className="text-sm text-muted hover:text-fg">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Submit({ disabled, editing }: { disabled: boolean; editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={disabled || pending}
      className={cn(
        "btn btn-accent",
        (disabled || pending) && "pointer-events-none opacity-40",
      )}
    >
      {pending ? "Saving…" : editing ? "Save changes" : "Add to the crew"}
    </button>
  );
}

function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "border border-line bg-bg px-4 py-3 text-sm outline-none transition-colors focus:border-accent",
        className ?? "w-full",
      )}
    />
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

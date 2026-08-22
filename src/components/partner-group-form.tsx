"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import type { PartnerGroup } from "@prisma/client";
import { createPartnerGroup, updatePartnerGroup } from "@/app/actions/company";
import { RobloxAvatar } from "@/components/roblox-picker";
import { cn, robloxGroupUrl } from "@/lib/utils";

// Adding a group to "Our Partners" on partner.ronation.live.
//
// The Roblox group is IDENTIFIED BY ITS ID, never by a name typed into a form - the same
// rule TeamMemberForm follows for a crew member's Roblox account. On create, the id is the
// only thing the admin provides; the server re-resolves the name, icon and member count
// from Roblox before anything is saved (see createPartnerGroup). On edit, the id is locked
// for the same reason the crew's Roblox account is locked: a card IS a Roblox group - to
// point it at a different one, remove this card and add a new one.

export function PartnerGroupForm({ group }: { group?: PartnerGroup }) {
  const editing = Boolean(group);

  return (
    <form
      action={editing ? updatePartnerGroup : createPartnerGroup}
      className="card space-y-5 p-6"
    >
      {group ? <input type="hidden" name="id" value={group.id} /> : null}

      <Field
        label="Roblox group"
        hint={
          editing
            ? "Locked. A card IS a Roblox group - to point it at a different one, remove this one and add it."
            : "The group's numeric id. Its name, icon and member count come from Roblox, not from here."
        }
      >
        {editing ? (
          <div className="flex items-center gap-3 border border-line bg-bg px-3 py-2.5">
            <RobloxAvatar src={group!.iconUrl} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{group!.name}</p>
              <a
                href={robloxGroupUrl(group!.robloxGroupId)}
                target="_blank"
                rel="noreferrer"
                className="truncate text-xs text-muted hover:text-accent"
              >
                {group!.robloxGroupId} ↗
              </a>
            </div>
          </div>
        ) : (
          <Input
            name="robloxGroupId"
            required
            inputMode="numeric"
            pattern="[0-9]+"
            placeholder="636922593"
          />
        )}
      </Field>

      <Field
        label="Description"
        hint="Why this group is credited here. Shown on the card, on partner.ronation.live."
      >
        <textarea
          name="description"
          required
          rows={3}
          maxLength={400}
          defaultValue={group?.description ?? ""}
          className="w-full resize-y border border-line bg-bg px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Order" hint="Lower sorts first.">
          <Input
            type="number"
            name="order"
            defaultValue={String(group?.order ?? 0)}
            className="w-28"
          />
        </Field>

        <Field label="On the site">
          <label className="flex items-center gap-2.5 py-2.5 text-sm text-muted">
            <input
              type="checkbox"
              name="visible"
              defaultChecked={group ? group.visible : true}
              className="h-4 w-4 accent-accent"
            />
            Show on &quot;Our Partners&quot;
          </label>
          <p className="mt-1 text-xs text-faint">
            Unticking hides the card and keeps the group. It comes back with its
            description and ordering intact.
          </p>
        </Field>
      </div>

      <div className="flex items-center gap-3 border-t border-line pt-5">
        <Submit editing={editing} />
        <Link href="/company/partner-groups" className="text-sm text-muted hover:text-fg">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Submit({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className={cn("btn btn-accent", pending && "pointer-events-none opacity-40")}
    >
      {pending ? "Saving…" : editing ? "Save changes" : "Add partner"}
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

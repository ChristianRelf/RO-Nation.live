"use client";

import { useState } from "react";
import { PartnerRole, type PartnerMember } from "@prisma/client";
import {
  addPartnerMember,
  removePartnerMember,
  setPartnerMemberRole,
} from "@/app/actions/partner-members";
import { ConfirmButton } from "@/components/confirm-button";
import { PickedUser, RobloxAvatar, RobloxPicker } from "@/components/roblox-picker";
import type { RobloxProfile } from "@/lib/roblox-users";
import { cn, robloxProfileUrl } from "@/lib/utils";

// The member list, rendered identically on both doors: RNL's /company/partners/<slug> and
// the partner's own /<slug>/members.
//
// One component, because they are one thing. Two copies of a screen that grants access to
// somebody else's organisation is two places for the last-owner check to be missing from.
//
// `via` says which door this is. It travels on the form body and it authorises NOTHING -
// the action re-runs the guard for that door against the caller's session. Sending
// via="company" from the partner's page gets you requireCompanyUser(), which a partner is
// not, and a redirect. See the header of actions/partner-members.ts.

const ALL_ROLES: { value: PartnerRole; label: string; blurb: string }[] = [
  { value: "STAFF", label: "Staff", blurb: "Read the lists. Work the door. Change nothing." },
  { value: "MANAGER", label: "Manager", blurb: "Edit the lists and mint API keys." },
  { value: "OWNER", label: "Owner", blurb: "A manager who can also grant and revoke access." },
];

export function PartnerMembers({
  slug,
  via,
  members,
  search,
  /** RNL staff may remove the last owner. The partner's own owner may not. */
  canRemoveLastOwner,
  /**
   * Which roles this door offers. Defaults to all three.
   *
   * SHASHA passes [STAFF, MANAGER] because its membership is administered from
   * the Studio and nowhere else - there is no "may grant others" tier to hand
   * out, so an Owner button there would set a role that behaves exactly like
   * Manager. Offering a choice that changes nothing is worse than not offering
   * it: somebody picks it believing it did something.
   */
  roles = ALL_ROLES.map((r) => r.value),
  /** Replaces the "nobody at this partner can sign in" line, which SHASHA outgrows. */
  emptyNote,
}: {
  slug: string;
  via: "company" | "portal";
  members: PartnerMember[];
  search: (query: string) => Promise<RobloxProfile[]>;
  canRemoveLastOwner: boolean;
  roles?: PartnerRole[];
  emptyNote?: string;
}) {
  const ROLES = ALL_ROLES.filter((r) => roles.includes(r.value));

  const [picked, setPicked] = useState<RobloxProfile | null>(null);
  const [role, setRole] = useState<PartnerRole>(roles[0] ?? "STAFF");

  const owners = members.filter((m) => m.role === "OWNER");
  const lastOwner = (m: PartnerMember) =>
    m.role === "OWNER" && owners.length === 1;

  return (
    <div className="space-y-6">
      {/* ---- Add ---- */}
      <form action={addPartnerMember} className="card space-y-4 p-6">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="via" value={via} />
        <input type="hidden" name="robloxId" value={picked?.robloxId ?? ""} />
        <input type="hidden" name="role" value={role} />

        <div>
          <h2 className="font-display text-xl">Give somebody access</h2>
          <p className="mt-1 text-sm text-muted">
            Search Roblox and pick the account. The id is re-checked against Roblox
            before anything is written - a username is a label somebody can change, the
            id is the person.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Roblox account
          </label>
          {picked ? (
            <PickedUser profile={picked} onClear={() => setPicked(null)} />
          ) : (
            <RobloxPicker search={search} onPick={setPicked} />
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            What they can do
          </label>
          {/* Written out rather than interpolated: Tailwind scans for whole class
              names, so a `sm:grid-cols-${n}` would be purged from the build. */}
          <div
            className={cn(
              "grid gap-1.5",
              ROLES.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
            )}
          >
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                aria-pressed={role === r.value}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left transition-colors",
                  role === r.value
                    ? "border-accent bg-accent-soft"
                    : "border-line hover:border-fg/30",
                )}
              >
                <span
                  className={cn(
                    "block text-sm font-semibold",
                    role === r.value ? "text-accent" : "text-fg",
                  )}
                >
                  {r.label}
                </span>
                <span className="mt-0.5 block text-xs text-muted">{r.blurb}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          disabled={!picked}
          className={cn("btn btn-accent", !picked && "pointer-events-none opacity-40")}
        >
          Add them
        </button>
      </form>

      {/* ---- The list ---- */}
      {members.length ? (
        <div className="space-y-3">
          {members.map((m) => {
            const locked = lastOwner(m) && !canRemoveLastOwner;

            return (
              <div key={m.id} className="card flex flex-wrap items-center gap-4 p-4">
                <RobloxAvatar src={m.avatarUrl} size={44} />

                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{m.displayName}</p>
                  <a
                    href={robloxProfileUrl(m.robloxId)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-faint hover:text-accent"
                  >
                    @{m.robloxUsername} · {m.robloxId} ↗
                  </a>
                  {m.addedByName ? (
                    <p className="mt-0.5 text-xs text-faint">
                      Added by {m.addedByName}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {ROLES.map((r) => (
                    <form action={setPartnerMemberRole} key={r.value}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="via" value={via} />
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="role" value={r.value} />
                      <button
                        // Demoting the only owner locks the partner out of their own
                        // member admin permanently. The button is disabled here AND the
                        // action refuses - the UI hiding a button is not a permission.
                        disabled={locked && r.value !== "OWNER"}
                        title={
                          locked && r.value !== "OWNER"
                            ? "They're the only owner. Promote somebody else first."
                            : undefined
                        }
                        className={cn(
                          "rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
                          m.role === r.value
                            ? "border-accent bg-accent-soft text-accent"
                            : "border-line text-muted hover:text-fg",
                          locked &&
                            r.value !== "OWNER" &&
                            "cursor-not-allowed opacity-30 hover:text-muted",
                        )}
                      >
                        {r.label}
                      </button>
                    </form>
                  ))}

                  <form action={removePartnerMember} className="ml-2">
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="via" value={via} />
                    <input type="hidden" name="id" value={m.id} />
                    <ConfirmButton
                      className={cn(
                        "text-xs text-faint hover:text-red-400",
                        locked && "cursor-not-allowed opacity-30 hover:text-faint",
                      )}
                      message={`Remove ${m.displayName}? They lose access to the portal immediately.`}
                    >
                      Remove
                    </ConfirmButton>
                  </form>
                </div>

                {locked ? (
                  <p className="w-full text-xs text-amber-300">
                    The only owner. Promote somebody else before changing this, or
                    nobody here will be able to grant access again.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <p className="font-display text-2xl">Nobody has access</p>
          <p className="mt-2 max-w-md text-muted">
            {emptyNote ??
              "Until somebody is added here, nobody at this partner can sign in to their portal at all."}
          </p>
        </div>
      )}
    </div>
  );
}

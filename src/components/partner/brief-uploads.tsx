"use client";

import { useState } from "react";
import type { PartnerBriefAssetSlot } from "@prisma/client";
import { BRIEF_ASSET_SLOTS } from "@/lib/partner-brief";
import { cn } from "@/lib/utils";

// The files half of a site brief.
//
// ---- Why this is not part of the form ------------------------------------
//
// Everything else on the brief posts as one server action. Files cannot: a server action
// caps its body at 1 MB, and a logo is routinely more than that. So uploads go to
// api/partner/brief as their own fetch, and land immediately.
//
// That difference is deliberately visible to the person using it. Files say "added" the
// moment they are; the text fields say "save" and mean it. A UI that hid the distinction
// would be one where somebody uploads four images, closes the tab, and finds out later
// that half their brief did not save.
//
// ---- Why the list is local state, seeded from the server ------------------
//
// The obvious build is router.refresh() after each upload, which re-renders the page from
// the database. It is wrong here: this component sits inside a long form full of typing
// somebody has not saved yet, and re-rendering the tree around it is how that gets lost.
//
// So the server hands over what it has once, and this appends to it. The list can only
// drift from the database if a second tab is uploading to the same brief, and the cost of
// that is a stale row on screen until reload - against the cost of losing four paragraphs.

export type BriefAsset = {
  id: string;
  slot: PartnerBriefAssetSlot;
  filename: string;
  mime: string;
  size: number;
};

const kb = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;

export function BriefUploads({
  token,
  initial,
}: {
  token: string;
  initial: BriefAsset[];
}) {
  const [assets, setAssets] = useState<BriefAsset[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(slot: PartnerBriefAssetSlot, file: File) {
    setBusy(slot);
    setError(null);

    const body = new FormData();
    body.set("token", token);
    body.set("slot", slot);
    body.set("file", file);

    try {
      const res = await fetch("/api/partner/brief", { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        // The route's own message when it gave one - it knows which cap was broken and
        // which types it takes, and inventing a vaguer sentence here would be worse.
        setError(json?.error ?? "That didn't upload. Try again in a moment.");
        return;
      }
      setAssets((current) => [...current, json as BriefAsset]);
    } catch {
      setError("That didn't upload - check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(
        `/api/partner/brief?token=${encodeURIComponent(token)}&id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        setError("That didn't delete. Reload and try again.");
        return;
      }
      setAssets((current) => current.filter((a) => a.id !== id));
    } catch {
      setError("That didn't delete - check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p
          role="alert"
          className="rounded-brand border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </p>
      ) : null}

      {BRIEF_ASSET_SLOTS.map((slot) => {
        const held = assets.filter((a) => a.slot === slot.slot);
        return (
          <div key={slot.slot} className="rounded-brand border border-line p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-display text-lg leading-tight">{slot.label}</p>
              {slot.required ? (
                <span className="text-[10px] font-bold uppercase tracking-kicker text-accent">
                  We really need this one
                </span>
              ) : (
                <span className="text-[10px] font-bold uppercase tracking-kicker text-faint">
                  Optional
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm text-muted">{slot.blurb}</p>

            {held.length ? (
              <ul className="mt-4 space-y-1.5">
                {held.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-line bg-bg px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{a.filename}</span>
                      <span className="block font-mono text-[11px] text-faint">
                        {a.mime} · {kb(a.size)}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(a.id)}
                      disabled={busy === a.id}
                      className="shrink-0 text-[10px] font-bold uppercase tracking-kicker text-faint transition-colors hover:text-red-400 disabled:opacity-50"
                    >
                      {busy === a.id ? "Removing" : "Remove"}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <label
              className={cn(
                "mt-4 inline-flex cursor-pointer items-center gap-2 rounded-brand border border-line px-4 py-2 text-xs font-semibold transition-colors hover:border-accent hover:text-accent",
                busy === slot.slot && "pointer-events-none opacity-60",
              )}
            >
              {busy === slot.slot ? "Uploading..." : held.length ? "Add another" : "Add a file"}
              <input
                type="file"
                className="sr-only"
                accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  // Cleared straight away so the same file can be picked twice - after a
                  // failed upload, "choose the same file again" otherwise does nothing at
                  // all, because the input's value has not changed.
                  e.target.value = "";
                  if (file) void upload(slot.slot, file);
                }}
              />
            </label>
          </div>
        );
      })}

      <p className="text-xs text-faint">
        Files upload as soon as you pick them - they are not waiting on the Save button
        below. JPG, PNG, GIF, WebP, SVG or PDF; images up to 5 MB, PDFs up to 25 MB.
      </p>
    </div>
  );
}

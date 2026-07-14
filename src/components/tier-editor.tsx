"use client";

import { useState } from "react";

// The tier editor inside the event form.
//
// The rows are posted as ONE json field rather than as tier[0][name] style
// indexed inputs. Indexed names have to be re-assembled by hand on the server,
// and a gap in the indices (remove row 1 of 3) is exactly the kind of thing that
// re-assembly gets subtly wrong. A single field is parsed and validated in one
// place - see readTiersForm() in lib/tickets/tiers-form.ts, which runs it through
// zod and refuses anything that doesn't fit. Nothing here is trusted.

export type TierDraft = {
  id?: string;
  name: string;
  description: string;
  perks: string; // one per line, split on the server
  priceRobux: number;
  capacity: number;
  active: boolean;
};

const BLANK: TierDraft = {
  name: "",
  description: "",
  perks: "",
  priceRobux: 0,
  capacity: 0,
  active: true,
};

const inputClass =
  "w-full rounded-brand border border-line bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-accent";
const labelClass =
  "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-faint";

export function TierEditor({
  initial,
  robuxEnabled,
}: {
  initial: TierDraft[];
  /** Whether this org can actually SELL a priced tier today. It cannot. */
  robuxEnabled: boolean;
}) {
  const [tiers, setTiers] = useState<TierDraft[]>(initial);

  const patch = (i: number, next: Partial<TierDraft>) =>
    setTiers((rows) => rows.map((r, n) => (n === i ? { ...r, ...next } : r)));

  const anyPaid = tiers.some((t) => t.priceRobux > 0);

  return (
    <div className="card space-y-5 p-6">
      <div>
        <h3 className="font-display text-lg">Ticket tiers</h3>
        <p className="mt-1 text-xs text-faint">
          Leave this empty and the event sells a single free General Admission -
          which is what every event did before tiers existed.
        </p>
      </div>

      {/* The one field the server actually reads. */}
      <input type="hidden" name="tiers" value={JSON.stringify(tiers)} />

      {!robuxEnabled && anyPaid ? (
        <p className="rounded-brand border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-xs text-amber-200">
          <span className="font-semibold">Robux payments are switched off.</span>{" "}
          You can price a tier now, but it will show at checkout as locked and
          cannot be issued to anyone. Nothing is charged and nobody gets in on it.
        </p>
      ) : null}

      {tiers.length === 0 ? (
        <p className="rounded-brand border border-dashed border-line px-4 py-6 text-center text-sm text-faint">
          No tiers. This event sells one free General Admission.
        </p>
      ) : null}

      <div className="space-y-4">
        {tiers.map((tier, i) => (
          <div
            key={i}
            className="rounded-brand border border-line bg-bg/40 p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-faint">
                Tier {i + 1}
              </span>
              <button
                type="button"
                onClick={() => setTiers((r) => r.filter((_, n) => n !== i))}
                className="text-xs text-faint transition-colors hover:text-red-400"
              >
                Remove
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_7rem_7rem]">
              <div>
                <label className={labelClass}>Name</label>
                <input
                  value={tier.name}
                  onChange={(e) => patch(i, { name: e.target.value })}
                  placeholder="VIP - Front Barrier"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Price (R$)</label>
                <input
                  type="number"
                  min={0}
                  value={tier.priceRobux}
                  onChange={(e) =>
                    patch(i, { priceRobux: Math.max(0, +e.target.value || 0) })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Capacity</label>
                <input
                  type="number"
                  min={0}
                  value={tier.capacity}
                  onChange={(e) =>
                    patch(i, { capacity: Math.max(0, +e.target.value || 0) })
                  }
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-3">
              <label className={labelClass}>Description</label>
              <input
                value={tier.description}
                onChange={(e) => patch(i, { description: e.target.value })}
                placeholder="Standing, main floor"
                className={inputClass}
              />
            </div>

            <div className="mt-3">
              <label className={labelClass}>Perks - one per line</label>
              <textarea
                rows={3}
                value={tier.perks}
                onChange={(e) => patch(i, { perks: e.target.value })}
                placeholder={"Early entry\nBarrier spot\nVIP chat channel"}
                className={`${inputClass} resize-y`}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={tier.active}
                  onChange={(e) => patch(i, { active: e.target.checked })}
                  className="h-4 w-4 accent-accent"
                />
                Active (on sale)
              </label>
              <p className="text-xs text-faint">
                Capacity 0 = uncapped. The event&apos;s own capacity still
                applies on top.
              </p>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setTiers((r) => [...r, { ...BLANK }])}
        className="btn btn-ghost w-full"
        disabled={tiers.length >= 8}
      >
        + Add tier
      </button>
    </div>
  );
}

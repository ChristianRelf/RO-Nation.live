"use client";

import { useState } from "react";
import {
  verifyCompanyGamePass,
  verifyPartnerGamePass,
  type VerifyPassState,
} from "@/app/actions/tiers";

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

  // ---- The two rails. A tier may have BOTH, and usually should ------------
  //
  // Not an enum, and not one field: they are the same seat sold in two places (see railsFor()
  // in lib/tickets/pricing.ts). "This VIP ticket can be bought on the website OR at the door,
  // but not both" is not a rule anybody wants.
  //
  //   gamePassId    bought on roblox.com, in a browser. The rail we can VERIFY afterwards,
  //                 and therefore the only one the web checkout can use. A pass is a
  //                 POSSESSION, owned forever - which is why it is @unique in the schema.
  //   devProductId  bought inside the experience, via ProcessReceipt. A product is a
  //                 PAYMENT, not a possession - so it is NOT unique, and it is the only way
  //                 to buy a ticket for a friend.
  //
  // "" means "not sold that way". It becomes NULL on the server, deliberately: @unique
  // treats empty strings as equal but NULLs as distinct, so storing "" would let the first
  // tier with no pass save and make every later one collide over a pass neither of them has.
  gamePassId: string;
  devProductId: string;
};

const BLANK: TierDraft = {
  name: "",
  description: "",
  perks: "",
  priceRobux: 0,
  capacity: 0,
  active: true,
  gamePassId: "",
  devProductId: "",
};

const inputClass =
  "w-full rounded-brand border border-line bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-accent";
const labelClass =
  "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-faint";

export function TierEditor({
  initial,
  robuxEnabled,
  eventId = "",
  scope = "",
}: {
  initial: TierDraft[];
  /** Whether this org can actually SELL a priced tier today. It cannot. */
  robuxEnabled: boolean;
  /** The event being edited, "" on a new one. Lets Verify ignore this event's own tiers. */
  eventId?: string;
  /** The partner slug, "" for RNL. Decides WHICH verify action is called - see below. */
  scope?: string;
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

            {/* The rails. Only on a PRICED tier - a free ticket has nothing to pay for, and
                asking a promoter for a game pass id to give something away is a question
                with no right answer. isUnsellable() in pricing.ts draws the same line. */}
            {tier.priceRobux > 0 ? (
              <Rails
                tier={tier}
                eventId={eventId}
                scope={scope}
                onChange={(next) => patch(i, next)}
              />
            ) : null}

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

/**
 * How a priced tier is actually paid for.
 *
 * The Verify button is the important thing on this row. A game pass id is eleven digits
 * pasted from another tab, and the three ways it goes wrong are all silent:
 *
 *   wrong id      every buyer lands on a 404 on roblox.com and nobody can pay.
 *   off sale      the tier looks perfect from here and sells nothing, all night.
 *   REUSED        it is last month's pass - and because a pass is owned FOREVER, every
 *                 buyer from last month walks into this show free, verified, waved through
 *                 by our own ownership check doing exactly what it was built to do.
 *
 * The third is why TicketTier.gamePassId is @unique, and the save refuses it (see
 * SyncTiersResult). This button is that refusal, asked politely, BEFORE the promoter has
 * typed out a whole show and lost the lot to a bounce.
 */
function Rails({
  tier,
  eventId,
  scope,
  onChange,
}: {
  tier: TierDraft;
  eventId: string;
  scope: string;
  onChange: (next: Partial<TierDraft>) => void;
}) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<VerifyPassState | null>(null);

  async function check() {
    setChecking(true);
    setResult(null);

    const form = new FormData();
    form.set("gamePassId", tier.gamePassId);
    form.set("eventId", eventId);
    form.set("scope", scope);

    // The client picks which action to call; each one PROVES the caller's authority for
    // itself, so picking wrong gets you bounced rather than somebody else's permission.
    // See the header of app/actions/tiers.ts.
    const next = scope
      ? await verifyPartnerGamePass(null, form)
      : await verifyCompanyGamePass(null, form);

    setResult(next);
    setChecking(false);
  }

  // The two warnings worth shouting about, and the one that is merely wrong.
  const mismatch =
    result?.ok && result.priceRobux !== null && result.priceRobux !== tier.priceRobux;

  return (
    <div className="mt-3 rounded-brand border border-line bg-bg/40 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">
        How it&apos;s paid for
      </p>

      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Game pass ID (web)</label>
          <div className="flex gap-2">
            <input
              value={tier.gamePassId}
              onChange={(e) => {
                onChange({ gamePassId: e.target.value.trim() });
                setResult(null);
              }}
              inputMode="numeric"
              placeholder="1234567890"
              className={inputClass}
            />
            <button
              type="button"
              onClick={check}
              disabled={checking || !tier.gamePassId}
              className="btn btn-ghost shrink-0 px-3 text-xs disabled:opacity-40"
            >
              {checking ? "…" : "Verify"}
            </button>
          </div>
          <p className="mt-1 text-xs text-faint">
            Bought on roblox.com. The only rail the website can sell.
          </p>
        </div>

        <div>
          <label className={labelClass}>Dev product ID (in-experience)</label>
          <input
            value={tier.devProductId}
            onChange={(e) => onChange({ devProductId: e.target.value.trim() })}
            inputMode="numeric"
            placeholder="9876543210"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-faint">
            Bought inside the show. The only rail that can gift a ticket.
          </p>
        </div>
      </div>

      {result ? (
        <div className="mt-3 space-y-1.5 text-xs">
          {!result.ok ? (
            <p className="text-red-300">
              {result.reason === "not_found"
                ? "Roblox has never heard of that pass. Check the id."
                : result.reason === "empty"
                  ? "Enter a pass id first."
                  : // We could not ask. NOT "the pass is broken" - saying that about a pass
                    // that is perfectly fine is the mistake merch/roblox.ts documents having
                    // already shipped once.
                    "Couldn't reach Roblox just now. Try again in a moment."}
            </p>
          ) : (
            <>
              <p className="text-fg">
                <span className="font-semibold">{result.name}</span>
                {result.priceRobux !== null ? ` · ${result.priceRobux} R$` : ""}
              </p>

              {result.takenBy ? (
                <p className="text-red-300">
                  <span className="font-semibold">
                    That pass is already on another tier
                  </span>{" "}
                  ({result.takenBy}). A pass is owned forever - reuse it and everyone who
                  bought that one gets into this show free. The save will refuse it.
                </p>
              ) : null}

              {!result.forSale ? (
                <p className="text-amber-300">
                  That pass is <span className="font-semibold">not for sale</span> on
                  Roblox. Nobody can buy it, so nobody can get this ticket.
                </p>
              ) : null}

              {mismatch ? (
                <p className="text-amber-300">
                  The pass costs{" "}
                  <span className="font-semibold">{result.priceRobux} R$</span>, but this
                  tier says {tier.priceRobux} R$. Roblox charges its own price - the tier is
                  only what we display.
                </p>
              ) : null}

              {result.forSale && !result.takenBy && !mismatch ? (
                <p className="text-emerald-300">Looks right.</p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

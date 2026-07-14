"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// The sticky bar at the bottom of the seat picker: what you are holding, for how long, and
// the way forward.
//
// ---- Why this does not use components/countdown.tsx -------------------------
//
// It was meant to. It cannot, and the reason is worth writing down rather than rediscovering.
//
// Countdown renders FOUR CELLS - days, hours, minutes, seconds - because it counts down to a
// SHOW, and a show is weeks away. A hold is ten minutes away, so three of those four cells
// are permanently "00" and the one that matters is the size of a footnote. Worse, when it
// reaches zero it announces "DOORS ARE OPEN" - which, on a hold that has just expired and
// taken the buyer's seat with it, is a sentence that means the exact opposite of what has
// happened.
//
// Two different facts, told two different ways. Generalising Countdown into both would put a
// `mode` prop on a component whose entire job is the clock on the homepage. So: fourteen
// lines of mm:ss here, and `onExpire`, which is the thing Countdown genuinely does not have.

/** mm:ss. Not a duration formatter - it is only ever counting down from ten minutes. */
function clock(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Under two minutes, the bar starts warning rather than just reporting. */
const URGENT_MS = 2 * 60_000;

export function HoldBar({
  seatLabel,
  tierName,
  price,
  expiresAt,
  onExpire,
  onRelease,
  onContinue,
  busy,
}: {
  /** What they are holding. Null on a tier with no map - see the picker. */
  seatLabel: string | null;
  tierName: string;
  price: string;
  /** ISO. The hold's death, decided by the server, not by this clock. */
  expiresAt: string;
  /**
   * Fired once, when the clock runs out.
   *
   * The clock is a DISPLAY of the hold, never the hold itself. The row expired on the
   * server the microsecond `expiresAt` passed, whatever this tab believes - a suspended
   * laptop, a clock skewed by a minute, a tab left open all night. So this exists to tell
   * the buyer, not to enforce anything.
   */
  onExpire: () => void;
  onRelease: () => void;
  onContinue: () => void;
  busy?: boolean;
}) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const at = new Date(expiresAt).getTime();

    // Fired at most once per hold. Without the flag a tab left open past expiry re-fires
    // onExpire every second, which would re-render the picker on a loop.
    let fired = false;

    const tick = () => {
      const ms = at - Date.now();
      setLeft(ms);
      if (ms <= 0 && !fired) {
        fired = true;
        onExpire();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // onExpire is intentionally not a dependency: the picker rebuilds it every render, and
    // depending on it would restart the interval a second at a time. The hold is identified
    // by expiresAt, and that is the only thing that should reset this clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);

  const urgent = left !== null && left <= URGENT_MS;

  return (
    <div className="sticky bottom-0 z-40 -mx-4 mt-6 border-t border-line bg-bg/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-kicker text-accent">
            Held for you
          </p>
          <p className="display mt-1 truncate text-xl">
            {seatLabel ?? tierName}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {tierName} · {price}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div
            className={cn(
              "text-right",
              urgent ? "text-red-400" : "text-muted",
            )}
            // One live region, and POLITE: a timer that interrupts a screen reader every
            // second is not urgency, it is an unusable page.
            aria-live="off"
          >
            <p className="tnum font-display text-2xl leading-none">
              {/* Blank until the effect runs. A number rendered on the server is stale
                  before it paints, and hydration tears when the client disagrees - the
                  same reason countdown.tsx opens on "--". */}
              {left === null ? "--:--" : clock(left)}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide">
              left to check out
            </p>
          </div>

          <button
            type="button"
            onClick={onRelease}
            disabled={busy}
            className="btn btn-ghost shrink-0 disabled:opacity-40"
          >
            Change
          </button>

          <button
            type="button"
            onClick={onContinue}
            disabled={busy}
            className="btn btn-accent shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Working…" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

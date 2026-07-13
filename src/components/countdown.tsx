"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// The clock to the next show. Rendered as four punched cells, because the point
// of a countdown is urgency and a paragraph of prose cannot carry it.
//
// The server has no business rendering a live clock: it would ship a number that
// is already stale by the time it paints, and hydration would tear when the
// client disagreed. So the first paint is deliberately blank ("--") and the real
// figures only arrive once we are mounted and ticking.

const UNITS = ["Days", "Hrs", "Min", "Sec"] as const;

function split(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [
    Math.floor(s / 86400),
    Math.floor((s % 86400) / 3600),
    Math.floor((s % 3600) / 60),
    s % 60,
  ];
}

export function Countdown({
  target,
  className,
  compact,
}: {
  /** ISO string — a Date can't cross the server/client boundary. */
  target: string;
  className?: string;
  compact?: boolean;
}) {
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    const at = new Date(target).getTime();
    const tick = () => setMs(at - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  const live = ms !== null && ms <= 0;
  const values = ms === null ? null : split(ms);

  if (live) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 border border-red-500/30 bg-red-500/10 px-3 py-2",
          className,
        )}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 bg-red-400" />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-red-400">
          Doors are open
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn("grid grid-cols-4 gap-px bg-line", className)}
      role="timer"
      aria-label="Time until the next show"
    >
      {UNITS.map((unit, i) => (
        <div
          key={unit}
          className={cn(
            "bg-surface text-center",
            compact ? "px-1 py-1.5" : "px-2 py-3",
          )}
        >
          <div
            className={cn(
              "font-display tnum leading-none text-fg",
              compact ? "text-xl" : "text-3xl",
            )}
          >
            {values ? String(values[i]).padStart(2, "0") : "--"}
          </div>
          <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-muted">
            {unit}
          </div>
        </div>
      ))}
    </div>
  );
}

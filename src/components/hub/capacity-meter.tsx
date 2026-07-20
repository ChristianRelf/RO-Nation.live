import type { NextShow } from "@/lib/hub-dashboard";

/**
 * How full a show is - as a hairline, or as a plain count.
 *
 * An UNCAPPED show (capacity 0) gets the number and no bar, and that is not a
 * missing feature. lib/tickets/crowd.ts makes the same argument about the same
 * data: a progress bar needs a denominator, and inventing one turns "412 people
 * are coming" into "412 of the 2,000 we failed to sell", which is a sentence about
 * inventory rather than about a crowd. There is no denominator here, so there is
 * no bar.
 */
export function CapacityMeter({ show }: { show: NextShow }) {
  if (show.capacity <= 0) {
    return (
      <p className="tnum mt-2 text-xs text-muted">
        <span className="font-semibold text-fg">{show.sold.toLocaleString()}</span>{" "}
        going
      </p>
    );
  }

  // Clamped: a comped or upgraded ticket can push a show a little over its stated
  // capacity, and a bar running off the end of its track reads as a broken page
  // rather than as a full room.
  const pct = Math.min(100, Math.round((show.sold / show.capacity) * 100));

  return (
    <div className="mt-2">
      <div
        className="h-px w-full bg-line"
        role="img"
        aria-label={`${show.sold} of ${show.capacity} tickets gone`}
      >
        <div
          className="h-px bg-accent transition-[width] duration-500 ease-settle"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="tnum mt-1.5 text-xs text-muted">
        <span className="font-semibold text-fg">{show.sold.toLocaleString()}</span>{" "}
        of {show.capacity.toLocaleString()}
        {pct >= 100 ? (
          <span className="ml-2 font-semibold uppercase tracking-wide text-accent">
            Full
          </span>
        ) : null}
      </p>
    </div>
  );
}

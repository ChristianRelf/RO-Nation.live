import type { NextShow } from "@/lib/hub-dashboard";

/** How many ticks the bar is cut into. Enough to read as a scale, few enough to count. */
const SEGMENTS = 28;

/**
 * How full a show is - as a segmented scale, or as a plain count.
 *
 * An UNCAPPED show (capacity 0) gets the number and no bar, and that is not a
 * missing feature. lib/tickets/crowd.ts makes the same argument about the same
 * data: a progress bar needs a denominator, and inventing one turns "412 people
 * are coming" into "412 of the 2,000 we failed to sell", which is a sentence about
 * inventory rather than about a crowd. There is no denominator here, so there is
 * no bar.
 *
 * The bar used to be a 1px hairline, which was honest about being a detail on a
 * crowded card. It is not a detail any more - it sits under the one show the hub
 * chose to lead with, and it is now cut into ticks so a glance lands on roughly
 * how full rather than on a smooth line needing its own label read.
 */
export function CapacityMeter({ show }: { show: NextShow }) {
  if (show.capacity <= 0) {
    return (
      <p className="tnum text-xs text-muted">
        <span className="font-semibold text-fg">{show.sold.toLocaleString()}</span>{" "}
        going
      </p>
    );
  }

  // Clamped: a comped or upgraded ticket can push a show a little over its stated
  // capacity, and a bar running off the end of its track reads as a broken page
  // rather than as a full room.
  const pct = Math.min(100, Math.round((show.sold / show.capacity) * 100));
  const lit = Math.round((pct / 100) * SEGMENTS);
  const full = pct >= 100;

  return (
    <div>
      <div
        className="flex gap-[3px]"
        role="img"
        aria-label={`${show.sold} of ${show.capacity} tickets gone`}
      >
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={`h-2.5 flex-1 rounded-[1px] transition-colors duration-500 ease-settle ${
              i < lit ? (full ? "bg-accent-hi" : "bg-accent") : "bg-fg/10"
            }`}
          />
        ))}
      </div>

      <p className="tnum mt-2 flex items-baseline gap-2 text-xs text-muted">
        <span className="font-semibold text-fg">{show.sold.toLocaleString()}</span>
        <span>of {show.capacity.toLocaleString()}</span>
        <span className="text-faint">·</span>
        <span className={full ? "font-bold uppercase tracking-kicker text-accent" : ""}>
          {full ? "Full" : `${pct}%`}
        </span>
      </p>
    </div>
  );
}

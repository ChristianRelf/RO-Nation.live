import { barcodeBars } from "@/lib/tickets/barcode";

// The barcode on the ticket. A real Code 128 — see lib/tickets/barcode.ts for why
// that is not a detail.
//
// Same two rules as the QR, for the same reasons. DARK INK ON PALE PAPER, never
// the brand accent: a scanner needs contrast, and a partner's accent may be dim
// gold. And THE QUIET ZONE IS PART OF THE MARK — ten clear modules at each end,
// drawn inside this component's own viewBox, so no caller can crop it off by
// setting the barcode flush against a border.

/** Code 128 wants at least 10 modules of clear space at each end. */
const QUIET = 10;
/** Depth across the bars, in viewBox units. Stretched by preserveAspectRatio. */
const DEPTH = 10;

export function TicketBarcode({
  value,
  /** Along the bars' run. */
  length = 190,
  /** Across them. */
  thickness = 46,
  /** Down the rail of a ticket, a barcode runs vertically. */
  vertical = false,
  className,
}: {
  value: string;
  length?: number;
  thickness?: number;
  vertical?: boolean;
  className?: string;
}) {
  const { bars, modules } = barcodeBars(value);
  const span = modules + QUIET * 2;

  return (
    <svg
      viewBox={vertical ? `0 0 ${DEPTH} ${span}` : `0 0 ${span} ${DEPTH}`}
      width={vertical ? thickness : length}
      height={vertical ? length : thickness}
      className={className}
      // The bars carry the data in their WIDTHS. Stretching them to fill the box
      // is fine — a scanner reads ratios — but they must not be letterboxed into
      // a smaller box and re-centred, which is what the default would do.
      preserveAspectRatio="none"
      role="img"
      aria-label={`Barcode for ticket ${value}`}
      shapeRendering="crispEdges"
    >
      {/* The paper. This rect IS the quiet zone: it must reach the viewBox edge. */}
      <rect width="100%" height="100%" fill="var(--paper)" />

      {bars.map((bar, i) =>
        vertical ? (
          <rect
            key={i}
            x={0}
            y={bar.x + QUIET}
            width={DEPTH}
            height={bar.width}
            fill="var(--paper-ink)"
          />
        ) : (
          <rect
            key={i}
            x={bar.x + QUIET}
            y={0}
            width={bar.width}
            height={DEPTH}
            fill="var(--paper-ink)"
          />
        ),
      )}
    </svg>
  );
}

import { qrMatrix } from "@/lib/qr";

// The entry mark on a ticket. A REAL QR code — point a phone at it and it opens
// the ticket. The thing this replaced was a hash sprayed into a grid: it looked
// like a QR and scanned as nothing.
//
// Two rules here are not style, they are the difference between a mark that
// works and one that only photographs well:
//
//   1. DARK INK ON CREAM PAPER, always — never the brand accent. Decoders need
//      contrast, and a brand accent is not required to be dark: Sleep Token RO's
//      is dim gold, which on their near-black site would be a gold-on-black QR
//      that no phone can read. `--paper-ink` on `--paper` is near-black on cream
//      under EVERY brand, because that is what those two tokens mean. The accent
//      gets the badge outline and nothing else.
//
//   2. THE QUIET ZONE IS PART OF THE MARK. Four light modules of margin, drawn
//      inside this component's own viewBox so no caller can crop it off by
//      putting the QR flush against something.
//
// Rendering is one <path> for every data module, with corners rounded only where
// they are actually exposed, so runs of modules melt into rounded ribbons instead
// of reading as a bag of loose dots. Pure, synchronous, no dependency, no canvas
// — it renders inside a server component, several to a page.

const QUIET = 4;

/** Trim float noise out of the path data — this string ships to every client. */
const f = (v: number) => Number(v.toFixed(3)).toString();

/** A unit cell, rounded only on the corners given a radius. */
function cell(
  x: number,
  y: number,
  tl: number,
  tr: number,
  br: number,
  bl: number,
) {
  const x1 = x + 1;
  const y1 = y + 1;
  let d = `M${f(x + tl)},${f(y)}`;
  d += `H${f(x1 - tr)}`;
  if (tr) d += `A${f(tr)},${f(tr)} 0 0 1 ${f(x1)},${f(y + tr)}`;
  d += `V${f(y1 - br)}`;
  if (br) d += `A${f(br)},${f(br)} 0 0 1 ${f(x1 - br)},${f(y1)}`;
  d += `H${f(x + bl)}`;
  if (bl) d += `A${f(bl)},${f(bl)} 0 0 1 ${f(x)},${f(y1 - bl)}`;
  d += `V${f(y + tl)}`;
  if (tl) d += `A${f(tl)},${f(tl)} 0 0 1 ${f(x + tl)},${f(y)}`;
  return `${d}Z`;
}

/** A finder. Rounded, but the 1:1:3:1:1 scanline through its centre is exact. */
function Eye({ x, y, ink, paper }: { x: number; y: number; ink: string; paper: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={7} height={7} rx={2.1} fill={ink} />
      <rect x={1} y={1} width={5} height={5} rx={1.4} fill={paper} />
      <rect x={2} y={2} width={3} height={3} rx={0.9} fill={ink} />
    </g>
  );
}

export function TicketQR({
  /** What the QR actually encodes — the ticket's own URL. */
  value,
  size = 200,
  /** The letters punched into the centre badge. A partner's ticket carries theirs. */
  mark = "RO",
  className,
}: {
  value: string;
  size?: number;
  mark?: string;
  className?: string;
}) {
  const m = qrMatrix(value);
  const n = m.length;
  const span = n + QUIET * 2;

  // The centre badge, and the gap of blank paper around it.
  //
  // The badge destroys the modules underneath it, and level H is what buys them
  // back. This is measured, not assumed: blanking a centred hole and decoding,
  // a 37×37 mark survives up to a 16-module hole (19% of its area) and fails at
  // 17. A badge of ~20% of the width, plus a one-module gutter, is a hole of
  // ~7% — a 3× margin on the point where it breaks, which is the room needed for
  // a real camera at a real angle in a dark room.
  const badge = Math.round(n * 0.2) | 1; // odd, so it centres on a module
  const hole = badge + 2;
  const holeStart = (n - hole) / 2;
  const holeEnd = holeStart + hole;

  const isFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);

  const isHole = (x: number, y: number) =>
    x >= holeStart && x < holeEnd && y >= holeStart && y < holeEnd;

  // "Painted" — a module that this loop actually draws. Finder and badge modules
  // are excluded, so neighbouring cells round against them as if they were blank,
  // which is exactly how they look.
  const on = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < n &&
    y < n &&
    m[y][x] &&
    !isFinder(x, y) &&
    !isHole(x, y);

  const R = 0.4;
  const parts: string[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!on(x, y)) continue;
      const up = on(x, y - 1);
      const down = on(x, y + 1);
      const left = on(x - 1, y);
      const right = on(x + 1, y);
      // A corner is exposed — and so rounded — only where both of its edges are.
      parts.push(
        cell(
          x + QUIET,
          y + QUIET,
          !up && !left ? R : 0,
          !up && !right ? R : 0,
          !down && !right ? R : 0,
          !down && !left ? R : 0,
        ),
      );
    }
  }

  const ink = "var(--paper-ink)";
  const paper = "var(--paper)";
  const mid = QUIET + n / 2;

  return (
    <svg
      viewBox={`0 0 ${span} ${span}`}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`QR code for ticket ${mark}`}
      shapeRendering="geometricPrecision"
    >
      {/* The paper. This rect IS the quiet zone — it must reach the viewBox edge. */}
      <rect width={span} height={span} fill={paper} />

      <path d={parts.join("")} fill={ink} />

      <Eye x={QUIET} y={QUIET} ink={ink} paper={paper} />
      <Eye x={QUIET + n - 7} y={QUIET} ink={ink} paper={paper} />
      <Eye x={QUIET} y={QUIET + n - 7} ink={ink} paper={paper} />

      {/* Brand badge, sitting in the gutter the module loop left for it. */}
      <g transform={`translate(${mid} ${mid})`}>
        <rect
          x={-badge / 2}
          y={-badge / 2}
          width={badge}
          height={badge}
          rx={1.4}
          fill={ink}
        />
        <text
          x={0}
          y={0.15}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={badge * 0.52}
          fontWeight={800}
          letterSpacing={-0.1}
          fontFamily="system-ui, sans-serif"
          fill={paper}
        >
          {mark}
        </text>
      </g>
    </svg>
  );
}

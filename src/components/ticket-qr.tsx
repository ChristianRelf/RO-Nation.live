// A custom-designed, decorative "QR" mark. It is NOT machine-scannable — real
// door verification uses the ticket `code` via the in-game API. But the module
// pattern is deterministically derived from the ticket code, so every ticket
// gets a unique, stable mark that "matches" its ID.
//
// Styling that sets it apart from a stock QR: rounded data dots, an accent
// gradient, custom rounded finder ("eye") patterns, and a logo badge punched
// out of the centre.

const GRID = 25; // modules per side (odd, so there's a true centre)

function bits(code: string, count: number) {
  const out: boolean[] = [];
  let h = 2166136261 >>> 0;
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  for (let i = 0; i < count; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    out.push((h & 1) === 1);
  }
  return out;
}

// The three 7x7 finder squares + the centre logo zone are reserved.
function isReserved(r: number, c: number) {
  const inEye = (er: number, ec: number) =>
    r >= er && r < er + 7 && c >= ec && c < ec + 7;
  if (inEye(0, 0) || inEye(0, GRID - 7) || inEye(GRID - 7, 0)) return true;
  // centre logo hole (9x9 around the middle)
  const mid = Math.floor(GRID / 2);
  if (Math.abs(r - mid) <= 4 && Math.abs(c - mid) <= 4) return true;
  return false;
}

function Eye({ x, y, grad }: { x: number; y: number; grad: string }) {
  // x,y are module coordinates of the eye's top-left; each eye is 7x7 modules.
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        x={0.5}
        y={0.5}
        width={6}
        height={6}
        rx={2}
        fill="none"
        stroke={grad}
        strokeWidth={1}
      />
      <rect x={2} y={2} width={3} height={3} rx={1} fill={grad} />
    </g>
  );
}

export function TicketQR({
  code,
  size = 176,
  className,
  // The two letters punched into the centre badge. A partner's ticket carries
  // their mark, not RNL's.
  mark = "RO",
}: {
  code: string;
  size?: number;
  className?: string;
  mark?: string;
}) {
  // An SVG id is global to the document, so several tickets on one page (which
  // is exactly what the wallet renders) would all point at the first mark's
  // gradient. Derive the id from the code and they stay distinct. The usual
  // answer is useId(), but this component also renders inside TicketStub, which
  // is a server component — no hooks available there.
  const gradId = `tq-${code.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const grad = `url(#${gradId})`;

  const cells = bits(code, GRID * GRID);
  const dots: JSX.Element[] = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (isReserved(r, c)) continue;
      if (!cells[r * GRID + c]) continue;
      dots.push(
        <circle key={`${r}-${c}`} cx={c + 0.5} cy={r + 0.5} r={0.42} fill={grad} />,
      );
    }
  }

  const mid = Math.floor(GRID / 2);

  return (
    <svg
      viewBox={`-1 -1 ${GRID + 2} ${GRID + 2}`}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`Decorative ticket mark for ${code}`}
      shapeRendering="geometricPrecision"
    >
      <defs>
        {/* var() only resolves in a CSS declaration, so the stops are set via
            `style`, not the SVG presentation attribute. */}
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" style={{ stopColor: "var(--accent)" }} />
          <stop offset="100%" style={{ stopColor: "var(--accent-hi)" }} />
        </linearGradient>
      </defs>

      {/* quiet-zone panel */}
      <rect
        x={-1}
        y={-1}
        width={GRID + 2}
        height={GRID + 2}
        rx={2.5}
        style={{ fill: "var(--elev)" }}
      />

      {dots}

      <Eye x={0} y={0} grad={grad} />
      <Eye x={GRID - 7} y={0} grad={grad} />
      <Eye x={0} y={GRID - 7} grad={grad} />

      {/* centre logo badge */}
      <g transform={`translate(${mid + 0.5} ${mid + 0.5})`}>
        <rect
          x={-4.4}
          y={-4.4}
          width={8.8}
          height={8.8}
          rx={2.5}
          style={{ fill: "var(--elev)" }}
          stroke={grad}
          strokeWidth={0.7}
        />
        <text
          x={0}
          y={0.1}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={3.6}
          fontWeight={800}
          fontFamily="system-ui, sans-serif"
          fill={grad}
        >
          {mark}
        </text>
      </g>
    </svg>
  );
}

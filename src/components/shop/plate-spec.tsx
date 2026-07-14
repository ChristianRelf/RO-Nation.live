import {
  LEFT_LIMB,
  RIGHT_LIMB,
  TEMPLATE_H,
  TEMPLATE_W,
  TORSO,
  type Net,
  type Rect,
} from "@/lib/merch/template";

// THE PATTERN PIECE - the cut, with no cloth in it.
//
// ---- What this replaced, and why ------------------------------------------
//
// This section used to be <PlateFlat>: the actual 585x559 clothing template, full
// width, at full resolution, in an <img>. It was the best-looking thing on the page.
// It was also the entire product, published: a classic Roblox shirt IS that PNG, so
// the page was handing every visitor a file they could upload to their own group and
// sell. One right-click.
//
// The instinct is to reach for a watermark or a disabled context menu. Both are
// theatre - the bytes are still on the wire. The only honest fix is to not send the
// artwork, so the artwork is not sent: it lives on the private volume and leaves the
// server only as shredded, sealed, per-face tiles (lib/merch/tiles.ts).
//
// But the SECTION was never really about the artwork. The reason it worked is that it
// told the truth about what a Roblox shirt is - not a photograph of a garment, but a
// cut-and-fold net of a torso and two arms, 64 pixels to the stud - and that truth is
// geometry, not ink. So the geometry is what is drawn: the same rectangles, measured
// from Roblox's own template file (lib/merch/template.ts), on a dashed cut-line, at
// exactly the proportions the real thing has.
//
// It gives away nothing. Roblox publishes this layout themselves; it is the same for
// every shirt ever made, and knowing it gets you no closer to owning this one.

/** The faces, in the order a cutter would read them. */
const FACES: readonly (keyof Net)[] = ["back", "right", "front", "left", "up", "down"];

const SHORT: Record<keyof Net, string> = {
  front: "F",
  back: "B",
  right: "R",
  left: "L",
  up: "T",
  down: "U",
};

type Piece = { rect: Rect; face: keyof Net };

function piecesOf(net: Net): Piece[] {
  return FACES.map((face) => ({ face, rect: net[face] }));
}

const PARTS: { label: string; net: Net }[] = [
  { label: "Torso", net: TORSO },
  { label: "R. Sleeve", net: RIGHT_LIMB },
  { label: "L. Sleeve", net: LEFT_LIMB },
];

export function PlateSpec({ kind }: { kind: "SHIRT" | "TSHIRT" | "PANTS" }) {
  // A t-shirt is a decal on one face, not a net. There is no pattern to draw, and
  // drawing a shirt's one would be a lie about the product.
  if (kind === "TSHIRT") return null;

  const limbLabel = kind === "PANTS" ? ["Torso", "R. Leg", "L. Leg"] : null;

  return (
    <section className="mt-20">
      <div className="flex items-end justify-between gap-6">
        <h2 className="kicker">The pattern piece</h2>
        <p className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-faint sm:block">
          {TEMPLATE_W} &times; {TEMPLATE_H} &middot; 64 px / stud
        </p>
      </div>

      <div className="crop-marks pattern-piece mt-5 rounded-brand bg-elev p-6 sm:p-10">
        <svg
          viewBox={`0 0 ${TEMPLATE_W} ${TEMPLATE_H}`}
          className="mx-auto block h-auto w-full max-w-2xl"
          role="img"
          aria-label={`The cut of a classic Roblox ${kind.toLowerCase()}: a torso and two limbs, unwrapped flat.`}
        >
          {PARTS.map((part, p) => (
            <g key={part.label}>
              {piecesOf(part.net).map(({ rect, face }) => (
                <g key={`${part.label}-${face}`}>
                  <rect
                    x={rect.x}
                    y={rect.y}
                    width={rect.w}
                    height={rect.h}
                    // Currency, not colour: stroke is the page's accent at low alpha, so
                    // this drawing re-brands with the rest of the shop and never has to
                    // know which shelf it is on.
                    className="fill-accent/[0.05] stroke-accent/40"
                    strokeWidth={2}
                    strokeDasharray="7 5"
                    rx={3}
                  />
                  <text
                    x={rect.x + rect.w / 2}
                    y={rect.y + rect.h / 2 + 6}
                    textAnchor="middle"
                    className="fill-accent/50 font-mono"
                    style={{ fontSize: 22, letterSpacing: 1 }}
                  >
                    {SHORT[face]}
                  </text>
                </g>
              ))}

              {/* The part's name, hung above its net. */}
              <text
                x={part.net.up.x + part.net.up.w / 2}
                y={part.net.up.y - 12}
                textAnchor="middle"
                className="fill-faint font-mono uppercase"
                style={{ fontSize: 17, letterSpacing: 2 }}
              >
                {limbLabel ? limbLabel[p] : part.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <p className="mt-4 font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-faint">
        F front &middot; B back &middot; R right &middot; L left &middot; T top &middot; U
        under. The garment above is this net, folded.
      </p>
    </section>
  );
}

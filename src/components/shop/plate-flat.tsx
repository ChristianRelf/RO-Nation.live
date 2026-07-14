import { LEFT_LIMB, RIGHT_LIMB, TEMPLATE_H, TEMPLATE_W, TORSO } from "@/lib/merch/template";

// THE FLAT: the garment, cut open and laid out.
//
// This is the move no other shop on the internet can make, and the reason is that it
// is TRUE rather than decorative. A classic Roblox shirt is not a photograph of a
// shirt - it is a 585x559 cube unwrap at 64px/stud, a cut-and-fold net of a torso and
// two arms (lib/merch/template.ts, measured from Roblox's own template file). The
// character above is that same ink, wrapped onto a body. They are not "the good one
// and the fallback": they are the pattern piece and the mannequin, which is precisely
// what sits on a real merch table.
//
// It costs one <img> of an asset the page has already loaded, it shows the buyer the
// artwork flat at full fidelity in a way the 3D never can - and every Roblox kid who
// has ever made a shirt knows that exact PNG on sight.

/**
 * Where to hang each callout, as a percentage of the template.
 *
 * Derived from the real rects rather than eyeballed, so if Roblox ever moves a net the
 * labels move with it. `left` is the centre of the net's front face; `top` sits just
 * above it.
 */
const CALLOUTS = [
  { label: "Torso", rect: TORSO.front },
  { label: "R. Arm", rect: RIGHT_LIMB.front },
  { label: "L. Arm", rect: LEFT_LIMB.front },
].map((c) => ({
  label: c.label,
  left: ((c.rect.x + c.rect.w / 2) / TEMPLATE_W) * 100,
  top: ((c.rect.y + c.rect.h / 2) / TEMPLATE_H) * 100,
}));

export function PlateFlat({ src, name }: { src: string; name: string }) {
  return (
    <section className="mt-20">
      <div className="flex items-end justify-between gap-6">
        <h2 className="kicker">The pattern piece</h2>
        <p className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-faint sm:block">
          {TEMPLATE_W} &times; {TEMPLATE_H} &middot; 64 px / stud
        </p>
      </div>

      <div className="crop-marks pattern-piece mt-5 rounded-brand bg-elev p-6 sm:p-10">
        <div className="relative mx-auto max-w-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`${name} - the classic clothing template it is printed from`}
            loading="lazy"
            decoding="async"
            className="h-auto w-full"
          />

          {CALLOUTS.map((c) => (
            <span
              key={c.label}
              aria-hidden
              className="absolute hidden -translate-x-1/2 -translate-y-1/2 sm:block"
              style={{ left: `${c.left}%`, top: `${c.top}%` }}
            >
              <span className="block h-8 w-px bg-accent/70" />
              <span className="mt-1 block whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.16em] text-accent">
                {c.label}
              </span>
            </span>
          ))}
        </div>
      </div>

      <p className="mt-4 font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-faint">
        This is the flat the garment above is printed from.
      </p>
    </section>
  );
}

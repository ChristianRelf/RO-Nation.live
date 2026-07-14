import Image from "next/image";
import { headers } from "next/headers";
import { partnerBySlug } from "@/lib/partners/registry";

// The room the merch table is in - and there is a show on.
//
// A SERVER component. There is no JavaScript in the background of this shop at all:
// every layer is a fixed, composited gradient or a transform-only animation. Nothing
// reads layout, nothing listens to scroll, nothing paints per frame.
//
// ---- Why the first two versions were boring, which is worth writing down ----
//
// v1 was texture with no architecture: a tint, a grid, some dust. A room is not a
// texture, and with no horizon every object on the page floats in a void.
//
// v2 added the architecture - wall, floor, scaffold, one lamp - and it was correct and
// it was still dull, because the MERCH TABLE IS AT THE BACK OF A VENUE AND THERE WAS NO
// VENUE IN IT. A stall in an empty room is a stall in an empty room.
//
// v3 is the room with the show in it: a truss across the top, lamps hung off it raking
// beams down through the haze, and a crowd between you and the stage. The table is lit
// by the spill. That is the whole idea, and it is why the light is the loudest thing
// here rather than the wallpaper being.
//
// ---- What it still refuses to do -------------------------------------------
//
// No mouse-following spotlight: it costs a layout read every frame, it is dead on
// touch, and a lamp bolted to a truss does not follow you round the room. No scroll
// parallax - the #1 source of jank on the mid-range phones this audience actually has.
// No filter: blur() on a full-viewport layer, which is the single most expensive thing
// you can put in a background. No particle canvas, no WebGL, no gradient blobs.
//
// The beams are hard-edged clip-path cones, and that is not a compromise - a beam
// cutting through haze HAS an edge, and that edge is the entire reason a lighting rig
// reads as a lighting rig instead of as a glow.

/**
 * The lighting rig. Deterministic - this renders on the server, and a random one would
 * hang different lamps in the HTML than the client draws on hydration.
 *
 * `lamp` is a CHANNEL, never a colour: --accent-rgb, --accent-hi-rgb or --fg-rgb. So on
 * Sleep Token the whole rig gels to gold, bone and pale gold on its own. A hex here
 * would be the one thing on the page that stayed RNL-blue on a partner's shelf.
 *
 * Mostly bone with two accent cans, because a rig gelled entirely in one colour is a
 * disco, and the shirts are the thing that is supposed to have the colour in it.
 */
const RIG = [
  { at: "8%", lamp: "--accent-rgb", from: -15, to: -4, dur: "23s", delay: "-4s", a: 0.24, w: "34%" },
  { at: "25%", lamp: "--accent-hi-rgb", from: -7, to: 6, dur: "31s", delay: "-11s", a: 0.16, w: "28%" },
  { at: "42%", lamp: "--accent-rgb", from: 5, to: -7, dur: "27s", delay: "-2s", a: 0.26, w: "26%" },
  { at: "58%", lamp: "--fg-rgb", from: -5, to: 8, dur: "35s", delay: "-18s", a: 0.1, w: "30%" },
  { at: "75%", lamp: "--accent-rgb", from: 9, to: -4, dur: "25s", delay: "-8s", a: 0.26, w: "28%" },
  { at: "92%", lamp: "--accent-hi-rgb", from: 4, to: 15, dur: "29s", delay: "-14s", a: 0.18, w: "34%" },
] as const;

/** Posters pasted on the hoarding, behind everything. Clustered where a flyposter can reach. */
const POSTERS = [
  { left: "1%", top: "16%", w: "12%", h: "24%", rot: "-1.6deg", a: 0.04 },
  { left: "11%", top: "30%", w: "10%", h: "19%", rot: "1.1deg", a: 0.028 },
  { left: "-2%", top: "44%", w: "11%", h: "21%", rot: "0.8deg", a: 0.032 },
  { left: "85%", top: "14%", w: "13%", h: "26%", rot: "1.4deg", a: 0.045 },
  { left: "89%", top: "40%", w: "12%", h: "20%", rot: "-1.2deg", a: 0.028 },
  { left: "77%", top: "31%", w: "9%", h: "16%", rot: "-2.2deg", a: 0.032 },
] as const;

/** Dust in the beams - so it drifts where the light is, not scattered evenly. */
const MOTES = [
  { left: "27%", top: "48%", dur: "26s", delay: "0s" },
  { left: "31%", top: "62%", dur: "31s", delay: "-6s" },
  { left: "58%", top: "44%", dur: "22s", delay: "-13s" },
  { left: "62%", top: "58%", dur: "34s", delay: "-3s" },
  { left: "74%", top: "40%", dur: "28s", delay: "-19s" },
  { left: "78%", top: "56%", dur: "24s", delay: "-9s" },
  { left: "44%", top: "52%", dur: "33s", delay: "-24s" },
  { left: "88%", top: "50%", dur: "18s", delay: "-15s" },
] as const;

export function VenueWall() {
  // The brand the MIDDLEWARE resolved from the URL, not anything the page passed down.
  //
  // That is what makes this work at all: VenueWall is mounted in app/merch/layout.tsx,
  // which sits ABOVE the [collection] segment and therefore has no idea which rail you
  // are looking at. But the middleware already worked the brand out from the path (see
  // brandFor + brandForCollection in src/middleware.ts) and stamped it on the request -
  // it is the same header the root layout reads to put data-brand on <html>. So the
  // backdrop follows the brand for free, and a future partner-branded collection gets
  // theirs with no change here.
  //
  // "" on the index and on /babymetal, which has no partner brand. Nothing renders.
  const brand = headers().get("x-ron-brand") || null;
  const backdrop = partnerBySlug(brand)?.backdropUrl ?? null;

  return (
    <div
      aria-hidden
      className="rig pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* ---- Back to front. ---- */}

      {/* 1. The hoarding: plywood boards, butted, battens behind. The ground the
             posters are pasted onto, so it stays quiet. */}
      <div className="flypost absolute inset-0" />

      {/* 2. Years of flyposting. */}
      {POSTERS.map((p, i) => (
        <span
          key={i}
          className="poster"
          style={
            {
              left: p.left,
              top: p.top,
              width: p.w,
              height: p.h,
              "--poster-rot": p.rot,
              "--poster-a": p.a,
            } as React.CSSProperties
          }
        />
      ))}

      {/* 2b. THE BACKDROP CLOTH, when the rail has a partner's brand on it.
              Sleep Token's flamingo, hung at the back of the stage.

              Deliberately NOT <PartnerBackdrop>, and the reason is the room. That
              component paints a photograph behind a WEBSITE, so it carries its own
              three-layer scrim and has to survive body copy being set straight on top of
              it. This one is a cloth hung inside a VENUE: it has a lighting rig in front
              of it, six beams screen-blending onto it, a crowd silhouetted against it and
              a house scrim over the bottom - so it has to be flatter and darker to
              RECEIVE that light rather than fight it. Same image, same registry field
              (partner.backdropUrl - one source of truth), different job.

              The filters follow the reasoning already written down on PartnerBackdrop:
              the photograph is magenta and the brand is gold, so the chroma comes down
              until the gold can sit on it - desaturated, not drained to grey, which would
              throw the picture's character away. Bottom-anchored, because the subject
              stands at the foot of the frame and the busy foliage is across the top. */}
      {backdrop ? (
        <div className="venue-backdrop absolute inset-0 overflow-hidden">
          {/* THE CROP IS THE WHOLE JOB, and it is not the one PartnerBackdrop uses.
              That component anchors the image to the BOTTOM, because on their website the
              bottom of the frame is where the bird stands and the top is where the busy
              magenta foliage is. Correct there. Fatal here: this room already has a crowd
              across the middle and a house scrim over the lower third, so a
              bottom-anchored flamingo lands exactly where it is buried, and all that
              survives is the foliage - the noise kept, the subject thrown away.

              So the frame is blown up and pulled UP, until the bird's head, neck and
              shoulders sit in the clear band between the lamps and the crowd (roughly
              20-50% of the viewport). Its legs stay behind the heads, which is what would
              actually happen: it is a cloth at the back of the stage and there are people
              standing in front of it. */}
          {/* Framed so the WHOLE bird - head, neck, body, legs - lands between roughly
              28% and 85% of the viewport, left of centre. `object-left` is what puts it
              there: the flamingo stands at 19% across the source frame, so showing the
              image's left edge rather than its centre is what walks it in off the margin
              instead of leaving it sliced by the edge of the screen. */}
          <div className="absolute inset-x-0 -top-[38%] h-[127%]">
            <Image
              src={backdrop}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-left"
            />
          </div>

          {/* The scrim. A GRADIENT, not the flat 45% wash this started as - that wash was
              what buried the bird. A flat black film crushes the wall and the flamingo
              into the same tone, and a silhouette with nothing behind it is not a
              silhouette, it is a smudge. Heavy where the type is (the top, and the bottom
              where the notice sits), and thin across the middle, where the picture is
              allowed to be a picture. */}
          <div className="absolute inset-0 bg-gradient-to-b from-bg via-bg/25 to-bg" />
          <div className="absolute inset-0 bg-bg/20" />
          {/* Tints the whole thing toward the brand's gold, which is what stops a magenta
              photograph and a gold room reading as two unrelated things. */}
          <div className="absolute inset-0 bg-accent/[0.07] mix-blend-overlay" />
        </div>
      ) : null}

      {/* 3. The building's own geometry, used sparingly as its comment asks. */}
      <div className="hairline-grid absolute inset-x-0 top-0 h-[62vh] opacity-20 [mask-image:linear-gradient(to_bottom,#000,transparent)]" />

      {/* 4. Scaffold uprights the rails bolt to. Wide screens only - on a phone they
             would just be two bars squeezing the content. */}
      <div className="scaffold left-[5%] hidden xl:block" />
      <div className="scaffold right-[5%] hidden xl:block" />

      {/* 5. THE STAGE. The light the crowd stands in front of, and the layer that makes
             the crowd exist at all: a silhouette is a HOLE in light, so cutting black
             heads out of a black wall draws precisely nothing. There has to be something
             bright behind them, and at a gig that something is the stage. */}
      <div className="stage-glow" />

      {/* 6. Haze for the beams to cut through. Without this a beam is a triangle. */}
      <div className="haze" />

      {/* 6. THE BEAMS. Screen-blended, so where two cross it gets brighter - which is
             the thing your eye is actually looking for, and which no amount of stacked
             alpha will fake. */}
      {RIG.map((l, i) => (
        <span
          key={`b${i}`}
          className="beam"
          style={
            {
              left: l.at,
              "--lamp-rgb": `var(${l.lamp})`,
              "--beam-a": l.a,
              "--beam-w": l.w,
              "--beam-from": `${l.from}deg`,
              "--beam-to": `${l.to}deg`,
              // The resting angle. Under prefers-reduced-motion the global rule crushes
              // animation-duration to nothing and, with no fill-mode, the element snaps
              // back to its BASE transform - so this is the pose a reduced-motion user
              // actually sees. It has to be a real one, not 0.
              "--beam-rot": `${(l.from + l.to) / 2}deg`,
              "--beam-dur": l.dur,
              "--beam-delay": l.delay,
            } as React.CSSProperties
          }
        />
      ))}

      {/* 7. The truss, and the lamps hung off it. Drawn AFTER the beams so the cans sit
             in front of the light they are throwing. */}
      <div className="truss" />
      {RIG.map((l, i) => (
        <span
          key={`p${i}`}
          className="par"
          style={
            {
              left: l.at,
              "--lamp-rgb": `var(${l.lamp})`,
              "--par-rot": `${(l.from + l.to) / 2}deg`,
            } as React.CSSProperties
          }
        />
      ))}

      {/* 8. Dust, in the beams. */}
      {MOTES.map((m, i) => (
        <span
          key={`m${i}`}
          className="mote"
          style={
            {
              left: m.left,
              top: m.top,
              "--mote-dur": m.dur,
              "--mote-delay": m.delay,
            } as React.CSSProperties
          }
        />
      ))}

      {/* 9. The floor. The light pools on it, because the rig is pointing at it.
             Drawn BEFORE the crowd, so the crowd stands ON it - the other way round and
             the floor's gradient washes straight over the silhouettes. */}
      <div className="venue-floor" />

      {/* 10. THE CROWD, between you and the stage. Heads and shoulders cut out of the
              page's own black, standing in front of the stage light - so they are a HOLE
              in it rather than a shape drawn on top of it, which is what a backlit crowd
              actually is. Two rows: the back one smaller, higher and hazier, because that
              is what makes it deep rather than flat. */}
      {/* Standing ON the horizon: the front row's feet are at the floor line, so the
          floor runs away from you toward them. The two rows are held well apart - when
          they were 2% apart they read as one thick band rather than as depth. */}
      <div className="crowd crowd-back bottom-[42%]" />
      <div className="crowd crowd-front bottom-[34%]" />

      {/* 11. HOUSE LIGHTS DOWN. The show is up there; the merch table is down here in
              the spill. This is what makes the spectacle affordable: everything above is
              lit and moving, and text cannot live on top of that. The light falls off
              toward the floor - which is what a room actually does, and which leaves the
              bottom half of every viewport calm enough to read a price on.

              It is not optional. Without it a hard-lit beam ran straight through the
              middle of the product page's spec table and made a row of it unreadable. */}
      <div className="house-scrim" />
    </div>
  );
}

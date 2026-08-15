"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { seatColour, tierColour, tierColourSoft } from "@/lib/venue/colors";
import type { Geom, Shape, VenueLayout } from "@/lib/venue/schema";
import { bounds, sectionSeats } from "@/lib/venue/seats";

// The venue, drawn.
//
// ONE renderer, used by the designer, the buyer's seat picker and the ticket stub. Not
// three - because three would drift, and the day the picker draws a chair the allocator
// does not believe in is the day somebody clicks a seat they can never buy.
//
// ---- Why SVG, and why the colours are what they are -----------------------
//
// SVG, not canvas, and the difference is not aesthetic. SVG gives hit-testing for free (a
// <polygon> knows when you clicked it), it renders on the server, and - the reason that
// actually decided it - IT CAN READ CSS CUSTOM PROPERTIES:
//
//     fill="rgb(var(--seat-free-rgb))"
//
// That one line is why a partner's seat map themes itself with no code. Canvas cannot do
// it, which is why components/ticket/ticket-download.tsx has a cssColor() helper that
// resolves the properties by hand at draw time. DO NOT copy that helper in here. It is the
// workaround for a limitation this file does not have, and using it would force the whole
// map to be a client component that paints grey for a frame and then corrects itself.
//
// ---- The one performance rule --------------------------------------------
//
// A section's SEATS are only mounted when that section is FOCUSED. A 2,000-seat venue is
// twenty polygons at the overview and about two hundred circles when you zoom into a
// block. Render all two thousand circles at once and the map janks on every hover, on
// every machine. That single rule is the difference between this feeling like Ticketmaster
// and feeling broken.

export type SeatState = "free" | "taken" | "held" | "selected";

export type VenueMapProps = {
  layout: VenueLayout;

  /** tierId -> its colour band. Built once by the caller; see tierColour(). */
  tierIndex?: ReadonlyMap<string, number>;

  /** Sold seats. */
  taken?: ReadonlySet<string>;
  /** Seats somebody else is mid-checkout on. */
  held?: ReadonlySet<string>;
  /** The one the buyer has picked. */
  selected?: string | null;

  /**
   * The section whose seats are drawn. Everything else stays a polygon.
   * Null = the overview. See the performance rule above.
   */
  focused?: string | null;

  /** Sections that are still buyable. Others are dimmed and inert. */
  sellable?: ReadonlySet<string> | null;

  /** Sections to grey out - a price filter, a sold-out tier. */
  dimmed?: ReadonlySet<string> | null;

  /** Selected in the DESIGNER (not the picker). Draws a handle outline. */
  activeShape?: string | null;

  onSectionClick?: (key: string) => void;
  onSectionHover?: (key: string | null) => void;
  onSeatClick?: (seatKey: string) => void;

  /** The designer sets this; the picker does not. */
  showGrid?: boolean;

  /**
   * Draw layout.backdrop - the promoter's tracing diagram - behind everything.
   *
   * The DESIGNER sets this true; the seat picker, the ticket stub and the door do
   * NOT, so a buyer never sees the working sketch a room was drawn over. It is a
   * design aid that happens to be persisted, not part of the sold map.
   */
  showBackdrop?: boolean;

  className?: string;
  /** An SVG viewBox override, for zooming into a section. */
  view?: { x: number; y: number; w: number; h: number } | null;
};

// ---- Geometry -> SVG -------------------------------------------------------

function shapePath(g: Geom) {
  if (g.type === "polygon") {
    return { as: "polygon" as const, points: g.points.map((p) => `${p.x},${p.y}`).join(" ") };
  }
  if (g.type === "ellipse") {
    return { as: "ellipse" as const, cx: g.cx, cy: g.cy, rx: g.rx, ry: g.ry };
  }
  return { as: "rect" as const, x: g.x, y: g.y, w: g.w, h: g.h };
}

/** A rect/ellipse spins about its own centre. A polygon carries its rotation in its points. */
function spin(g: Geom) {
  if (g.type === "polygon" || !g.rotation) return undefined;
  const b = bounds(g);
  return `rotate(${g.rotation} ${b.x + b.w / 2} ${b.y + b.h / 2})`;
}

function ShapeBody({
  g,
  fill,
  stroke,
  strokeWidth = 1,
  dash,
  className,
}: {
  g: Geom;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: string;
  className?: string;
}) {
  const p = shapePath(g);
  const common = {
    fill,
    stroke,
    strokeWidth,
    strokeDasharray: dash,
    transform: spin(g),
    className,
  };

  if (p.as === "polygon") return <polygon points={p.points} {...common} />;
  if (p.as === "ellipse") {
    return <ellipse cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} {...common} />;
  }
  return <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={2} {...common} />;
}

// ---- The map ---------------------------------------------------------------

export function VenueMap({
  layout,
  tierIndex,
  taken,
  held,
  selected,
  focused,
  sellable,
  dimmed,
  activeShape,
  onSectionClick,
  onSectionHover,
  onSeatClick,
  showGrid,
  showBackdrop,
  className,
  view,
}: VenueMapProps) {
  const vb = view ?? { x: 0, y: 0, w: layout.viewBox.w, h: layout.viewBox.h };

  // Paint order. Sorted here rather than relying on the array, because `z` is what a
  // designer sets with "bring to front" - while the ARRAY order is what best-available
  // reads as preference. They are two different questions and must not share one field.
  const shapes = useMemo(
    () => [...layout.shapes].sort((a, b) => a.z - b.z),
    [layout.shapes],
  );

  const colourFor = (s: Shape) => {
    if (s.kind !== "SEATED_SECTION" && s.kind !== "STANDING_AREA") return null;
    const idx = s.tierId ? tierIndex?.get(s.tierId) : undefined;
    return idx === undefined ? null : idx;
  };

  return (
    <svg
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      className={cn("h-full w-full select-none", className)}
      role="img"
      aria-label="Venue map"
    >
      {/* The tracing image, at the very bottom. Drawn in full layout coordinates (not the
          zoom window), so panning and zooming the canvas move it in lock-step with the
          shapes on top of it - which is the whole point of tracing over it. `meet` keeps the
          entire diagram visible rather than cropping it. */}
      {showBackdrop && layout.backdrop ? (
        <image
          href={layout.backdrop.url}
          x={0}
          y={0}
          width={layout.viewBox.w}
          height={layout.viewBox.h}
          opacity={layout.backdrop.opacity}
          preserveAspectRatio="xMidYMid meet"
          className="pointer-events-none"
        />
      ) : null}

      {showGrid ? (
        <>
          <defs>
            <pattern
              id="venue-grid"
              width={layout.grid}
              height={layout.grid}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${layout.grid} 0 L 0 0 0 ${layout.grid}`}
                fill="none"
                stroke="rgb(var(--venue-line-rgb) / 0.10)"
                strokeWidth={0.5}
              />
            </pattern>
          </defs>
          <rect
            x={vb.x}
            y={vb.y}
            width={vb.w}
            height={vb.h}
            fill="url(#venue-grid)"
          />
        </>
      ) : null}

      {shapes.map((s) => {
        const tier = colourFor(s);
        const isFocused = focused === s.key;
        const isDim = dimmed?.has(s.key) ?? false;
        const isSellable =
          (s.kind === "SEATED_SECTION" || s.kind === "STANDING_AREA") &&
          (sellable ? sellable.has(s.key) : true);

        // The stage must NEVER look like a section. If it reads as buyable, somebody
        // clicks it - and then has to be told that no, the stage is not for sale.
        if (s.kind === "STAGE") {
          return (
            <g key={s.key}>
              <ShapeBody
                g={s.geom}
                fill="rgb(var(--stage-rgb) / 0.85)"
                stroke="rgb(var(--stage-rgb))"
              />
              <SectionLabel
                shape={s}
                fill="rgb(var(--bg-rgb))"
                weight={700}
                size={11}
              />
            </g>
          );
        }

        if (s.kind === "DECOR" || s.kind === "GATE" || s.kind === "LABEL") {
          const isGate = s.kind === "GATE";
          return (
            <g key={s.key}>
              {s.kind !== "LABEL" ? (
                <ShapeBody
                  g={s.geom}
                  fill={isGate ? "rgb(var(--accent-rgb) / 0.10)" : "transparent"}
                  stroke="rgb(var(--venue-line-rgb) / 0.35)"
                  dash={isGate ? undefined : "4 3"}
                />
              ) : null}
              <SectionLabel
                shape={s}
                fill="rgb(var(--muted-rgb))"
                size={9}
              />
            </g>
          );
        }

        // A sellable section.
        const fill =
          tier === null
            ? "rgb(var(--seat-free-rgb) / 0.14)"
            : tierColourSoft(tier, isDim ? 0.05 : 0.2);

        const stroke =
          tier === null
            ? "rgb(var(--venue-line-rgb) / 0.3)"
            : isDim
              ? "rgb(var(--venue-line-rgb) / 0.15)"
              : tierColour(tier);

        return (
          <g
            key={s.key}
            className={cn(
              isSellable && onSectionClick && !isDim
                ? "cursor-pointer"
                : "cursor-default",
              "transition-opacity",
            )}
            opacity={isDim ? 0.35 : 1}
            onClick={
              isSellable && !isDim ? () => onSectionClick?.(s.key) : undefined
            }
            onMouseEnter={() => onSectionHover?.(s.key)}
            onMouseLeave={() => onSectionHover?.(null)}
          >
            <ShapeBody
              g={s.geom}
              fill={fill}
              stroke={stroke}
              strokeWidth={activeShape === s.key ? 2.5 : 1.2}
              dash={activeShape === s.key ? "5 3" : undefined}
            />

            {/* Seats, ONLY when this section is the focused one. The whole perf story. */}
            {isFocused && s.kind === "SEATED_SECTION"
              ? sectionSeats(s).map((seat) => {
                  const state: SeatState = selected === seat.key
                    ? "selected"
                    : taken?.has(seat.key)
                      ? "taken"
                      : held?.has(seat.key)
                        ? "held"
                        : "free";

                  const dead = state === "taken" || state === "held";

                  return (
                    <circle
                      key={seat.key}
                      cx={seat.cx}
                      cy={seat.cy}
                      r={Math.max(2.2, Math.min(6, vb.w / 90))}
                      fill={seatColour(state, tier)}
                      stroke={
                        state === "selected"
                          ? "rgb(var(--seat-selected-rgb))"
                          : "transparent"
                      }
                      strokeWidth={1.5}
                      opacity={dead ? 0.5 : 1}
                      className={cn(
                        !dead && onSeatClick ? "cursor-pointer" : "cursor-not-allowed",
                        "transition-transform",
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!dead) onSeatClick?.(seat.key);
                      }}
                    >
                      <title>
                        {`Row ${seat.row}, Seat ${seat.number}`}
                        {state === "taken"
                          ? " - sold"
                          : state === "held"
                            ? " - someone is buying this"
                            : ""}
                      </title>
                    </circle>
                  );
                })
              : null}

            {!isFocused ? (
              <SectionLabel
                shape={s}
                fill="rgb(var(--fg-rgb))"
                size={10}
                weight={600}
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function SectionLabel({
  shape,
  fill,
  size = 10,
  weight = 500,
}: {
  shape: Shape;
  fill: string;
  size?: number;
  weight?: number;
}) {
  const b = bounds(shape.geom);
  return (
    <text
      x={b.x + b.w / 2}
      y={b.y + b.h / 2}
      textAnchor="middle"
      dominantBaseline="central"
      fill={fill}
      fontSize={size}
      fontWeight={weight}
      className="pointer-events-none"
    >
      {shape.name}
    </text>
  );
}

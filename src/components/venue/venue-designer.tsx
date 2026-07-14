"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { emptyLayout, type Shape, type ShapeKind, type VenueLayout } from "@/lib/venue/schema";
import { seatCapacity, totalSeats } from "@/lib/venue/seats";
import { VenueMap } from "./venue-map";
import { ShapeInspector } from "./shape-inspector";

// The venue designer.
//
// Draw the room, then say which tier sits where.
//
// ---- The house pattern, followed exactly ---------------------------------
//
// The whole layout is one `useState` draft, serialised into ONE hidden JSON input, posted
// to a server action, and re-validated with zod (lib/venue/form.ts). That is not a stylistic
// choice - it is the pattern components/survey-builder.tsx and components/tier-editor.tsx
// already use, and tier-editor's header says why: indexed `shape[0][x]` field names have to
// be re-assembled by hand on the server, and a gap in the indices (remove shape 1 of 3) is
// exactly what re-assembly gets subtly wrong.
//
// Undo/redo is a stack of whole layouts, and it is CHEAP precisely because the draft is
// already one serialisable object. Do not make it granular - a diff-based undo would be
// three hundred lines to save a few kilobytes of memory nobody is short of.

const TOOLS: { kind: ShapeKind; label: string; hint: string }[] = [
  { kind: "STAGE", label: "Stage", hint: "The thing everyone is looking at. Sells nothing." },
  { kind: "SEATED_SECTION", label: "Seated block", hint: "Numbered rows and seats." },
  { kind: "STANDING_AREA", label: "Standing area", hint: "A pit or a gate. Capacity, no chairs." },
  { kind: "GATE", label: "Gate", hint: "An entrance. The door reads it." },
  { kind: "DECOR", label: "Decor", hint: "Bars, toilets, the desk. Means nothing." },
  { kind: "LABEL", label: "Label", hint: "Just text." },
];

type Tool = "select" | ShapeKind;

const HISTORY_CAP = 50;

/** A key nobody has used yet. Uppercase alphanumeric - see SECTION_KEY in venue/schema.ts. */
function freshKey(layout: VenueLayout, kind: ShapeKind) {
  const stem =
    kind === "STAGE" ? "ST" : kind === "GATE" ? "G" : kind === "SEATED_SECTION" ? "A" : kind === "STANDING_AREA" ? "P" : "D";

  const used = new Set(layout.shapes.map((s) => s.key));
  for (let i = 1; i < 200; i++) {
    const key = `${stem}${i}`;
    if (!used.has(key)) return key;
  }
  return `X${Date.now() % 1000}`;
}

export function VenueDesigner({
  initial,
  tiers,
  action,
  mapId,
  scope,
  mapName,
  error,
  strandedKeys,
  eventCapacity,
}: {
  initial: VenueLayout | null;
  /** The event's tiers, when this map belongs to an event. Empty for a template. */
  tiers: { id: string; name: string; priceRobux: number }[];
  action: (formData: FormData) => void;
  mapId: string;
  scope: string;
  mapName: string;
  error?: string;
  /** Seats the last save would have stranded. See saveVenueLayout(). */
  strandedKeys?: string[];
  /** The event's hard cap, if it has one. Warned against the seat count. */
  eventCapacity?: number;
}) {
  // A map that would not PARSE opens as empty - and we must say so, loudly, rather than
  // letting somebody hit Save over the top of a layout we simply failed to read.
  const unreadable = initial === null;

  const [layout, setLayout] = useState<VenueLayout>(initial ?? emptyLayout());
  const [tool, setTool] = useState<Tool>("select");
  const [active, setActive] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<{ x: number; y: number } | null>(null);
  const [poly, setPoly] = useState<{ x: number; y: number }[]>([]);

  const past = useRef<VenueLayout[]>([]);
  const future = useRef<VenueLayout[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const commit = useCallback((next: VenueLayout) => {
    setLayout((prev) => {
      past.current = [...past.current.slice(-HISTORY_CAP + 1), prev];
      future.current = [];
      return next;
    });
  }, []);

  const undo = () => {
    const prev = past.current.pop();
    if (!prev) return;
    setLayout((cur) => {
      future.current = [cur, ...future.current.slice(0, HISTORY_CAP - 1)];
      return prev;
    });
  };

  const redo = () => {
    const next = future.current.shift();
    if (!next) return;
    setLayout((cur) => {
      past.current = [...past.current, cur];
      return next;
    });
  };

  const snap = (n: number) => Math.round(n / layout.grid) * layout.grid;

  /** Browser pixels -> viewBox units. Without this, every shape lands in the wrong place. */
  const toLocal = (e: React.MouseEvent): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * layout.viewBox.w;
    const y = ((e.clientY - rect.top) / rect.height) * layout.viewBox.h;
    return { x: snap(x), y: snap(y) };
  };

  const addShape = (kind: ShapeKind, geom: Shape["geom"]) => {
    const key = freshKey(layout, kind);
    const z = layout.shapes.length;

    const base = { key, name: TOOLS.find((t) => t.kind === kind)!.label, geom, z };

    const shape: Shape =
      kind === "SEATED_SECTION"
        ? {
            ...base,
            kind,
            tierId: null,
            rows: {
              rows: 6,
              seatsPerRow: 10,
              rowLabelStart: "A",
              seatStart: 1,
              skips: [],
              curve: 0,
              rake: 0,
            },
          }
        : kind === "STANDING_AREA"
          ? { ...base, kind, tierId: null, capacity: 0 }
          : { ...base, kind };

    commit({ ...layout, shapes: [...layout.shapes, shape] });
    setActive(key);
    setTool("select");
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (tool === "select") return;
    const p = toLocal(e);
    if (!p) return;

    if (tool === "LABEL") {
      addShape("LABEL", { type: "rect", x: p.x, y: p.y, w: 80, h: 20, rotation: 0 });
      return;
    }
    setDrawing(p);
  };

  const onMouseUp = (e: React.MouseEvent) => {
    if (!drawing || tool === "select") return;
    const p = toLocal(e);
    setDrawing(null);
    if (!p) return;

    const x = Math.min(drawing.x, p.x);
    const y = Math.min(drawing.y, p.y);
    const w = Math.abs(p.x - drawing.x);
    const h = Math.abs(p.y - drawing.y);

    // A click, not a drag. Give them a default-sized block rather than a zero-area shape
    // that zod will reject and that they cannot see to delete.
    const rect = {
      type: "rect" as const,
      x,
      y,
      w: Math.max(w, layout.grid * 6),
      h: Math.max(h, layout.grid * 4),
      rotation: 0,
    };

    addShape(tool as ShapeKind, rect);
  };

  const patch = (key: string, next: Partial<Shape>) =>
    commit({
      ...layout,
      shapes: layout.shapes.map((s) => (s.key === key ? ({ ...s, ...next } as Shape) : s)),
    });

  const remove = (key: string) => {
    commit({ ...layout, shapes: layout.shapes.filter((s) => s.key !== key) });
    setActive(null);
  };

  const move = (key: string, by: number) => {
    const i = layout.shapes.findIndex((s) => s.key === key);
    const j = i + by;
    if (i < 0 || j < 0 || j >= layout.shapes.length) return;
    const shapes = [...layout.shapes];
    [shapes[i], shapes[j]] = [shapes[j], shapes[i]];
    commit({ ...layout, shapes });
  };

  const tierIndex = useMemo(
    () => new Map(tiers.map((t, i) => [t.id, i] as const)),
    [tiers],
  );

  const activeShape = layout.shapes.find((s) => s.key === active) ?? null;
  const seats = totalSeats(layout);

  const unmapped = tiers.filter(
    (t) =>
      !layout.shapes.some(
        (s) =>
          (s.kind === "SEATED_SECTION" || s.kind === "STANDING_AREA") &&
          s.tierId === t.id,
      ),
  );

  const overCapacity =
    typeof eventCapacity === "number" && eventCapacity > 0 && seats > eventCapacity;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={mapId} />
      <input type="hidden" name="scope" value={scope} />
      {/* The one field the server actually reads. */}
      <input type="hidden" name="layout" value={JSON.stringify(layout)} />

      {unreadable ? (
        <p className="rounded-brand border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <span className="font-semibold">This map could not be read.</span> The
          canvas below is EMPTY - it is not what is saved. Saving now would replace
          the real layout with nothing. Do not save unless you mean to redraw the
          venue from scratch.
        </p>
      ) : null}

      {error === "sold_seats" && strandedKeys?.length ? (
        <div className="rounded-brand border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          <p className="font-semibold">
            Not saved - that would strand {strandedKeys.length} ticket
            {strandedKeys.length === 1 ? "" : "s"}.
          </p>
          <p className="mt-1 text-xs">
            Somebody is holding these, and your new layout doesn&apos;t contain them:{" "}
            <span className="font-mono">{strandedKeys.slice(0, 12).join(", ")}</span>
            {strandedKeys.length > 12 ? ` and ${strandedKeys.length - 12} more` : ""}. Put
            them back, or move those people first.
          </p>
        </div>
      ) : null}

      {error === "unreadable" ? (
        <p className="rounded-brand border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          That layout didn&apos;t make sense and nothing was saved.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        {/* ---- The canvas ------------------------------------------------ */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <ToolButton
              on={tool === "select"}
              onClick={() => setTool("select")}
              label="Select"
            />
            {TOOLS.map((t) => (
              <ToolButton
                key={t.kind}
                on={tool === t.kind}
                onClick={() => setTool(t.kind)}
                label={t.label}
                title={t.hint}
              />
            ))}

            <span className="mx-1 h-5 w-px bg-line" />

            <ToolButton onClick={undo} label="Undo" disabled={!past.current.length} />
            <ToolButton onClick={redo} label="Redo" disabled={!future.current.length} />
          </div>

          <div
            className="relative overflow-hidden rounded-brand border border-line bg-bg"
            style={{ aspectRatio: `${layout.viewBox.w} / ${layout.viewBox.h}` }}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${layout.viewBox.w} ${layout.viewBox.h}`}
              className={cn(
                "absolute inset-0 h-full w-full",
                tool === "select" ? "cursor-default" : "cursor-crosshair",
              )}
              onMouseDown={onMouseDown}
              onMouseUp={onMouseUp}
            />
            <div className="pointer-events-none absolute inset-0">
              <VenueMap
                layout={layout}
                tierIndex={tierIndex}
                showGrid
                activeShape={active}
                focused={activeShape?.kind === "SEATED_SECTION" ? active : null}
              />
            </div>
            {/* The click layer sits ON TOP so section clicks reach the designer, not the
                map's own buyer-facing handlers. */}
            <svg
              viewBox={`0 0 ${layout.viewBox.w} ${layout.viewBox.h}`}
              className="absolute inset-0 h-full w-full"
              onMouseDown={onMouseDown}
              onMouseUp={onMouseUp}
              style={{ cursor: tool === "select" ? "default" : "crosshair" }}
            >
              {tool === "select"
                ? layout.shapes.map((s) => {
                    const b = boundsOf(s);
                    return (
                      <rect
                        key={s.key}
                        x={b.x}
                        y={b.y}
                        width={b.w}
                        height={b.h}
                        fill="transparent"
                        className="cursor-pointer"
                        onClick={() => setActive(s.key)}
                      />
                    );
                  })
                : null}
            </svg>
          </div>

          <p className="text-xs text-faint">
            {tool === "select"
              ? "Click a shape to edit it. Pick a tool above to draw a new one."
              : "Drag on the canvas to draw."}
          </p>
        </div>

        {/* ---- The inspector --------------------------------------------- */}
        <div className="space-y-3">
          <div className="card p-4">
            <h3 className="font-display text-sm">The room</h3>
            <dl className="mt-2 space-y-1 text-xs text-muted">
              <div className="flex justify-between">
                <dt>Shapes</dt>
                <dd className="font-mono">{layout.shapes.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Seats</dt>
                <dd className="font-mono">{seats}</dd>
              </div>
            </dl>

            {overCapacity ? (
              <p className="mt-3 rounded-brand border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                You have drawn <strong>{seats}</strong> seats but the event&apos;s
                capacity is <strong>{eventCapacity}</strong>. Capacity is a hard
                ceiling, so {seats - eventCapacity!} of these chairs can never be sold
                - and nothing on the seat map will explain why.
              </p>
            ) : null}

            {tiers.length > 0 && unmapped.length > 0 ? (
              <p className="mt-3 rounded-brand border border-line px-3 py-2 text-xs text-faint">
                <strong className="text-muted">
                  {unmapped.map((t) => t.name).join(", ")}
                </strong>{" "}
                {unmapped.length === 1 ? "has" : "have"} no section on this map, so{" "}
                {unmapped.length === 1 ? "it sells" : "they sell"} as ordinary general
                admission with no seat. That is fine, and often what you want.
              </p>
            ) : null}
          </div>

          {activeShape ? (
            <ShapeInspector
              shape={activeShape}
              tiers={tiers}
              seats={
                activeShape.kind === "SEATED_SECTION"
                  ? seatCapacity(activeShape)
                  : null
              }
              onChange={(next) => patch(activeShape.key, next)}
              onDelete={() => remove(activeShape.key)}
              onMove={(by) => move(activeShape.key, by)}
            />
          ) : (
            <div className="card p-4 text-xs text-faint">
              Nothing selected.
            </div>
          )}

          {/* The layers list. Its ORDER is the best-available order - see
              bestAvailableOrder() in lib/venue/seats.ts. Dragging a section up here is
              how a promoter says "offer this block first". */}
          <div className="card p-4">
            <h3 className="font-display text-sm">Order offered</h3>
            <p className="mt-1 text-xs text-faint">
              Best-available walks this list top to bottom. Put your best sections first.
            </p>
            <ul className="mt-3 space-y-1">
              {layout.shapes.map((s, i) => (
                <li
                  key={s.key}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-brand px-2 py-1 text-xs",
                    active === s.key ? "bg-accent-soft text-fg" : "text-muted",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setActive(s.key)}
                    className="flex-1 truncate text-left"
                  >
                    <span className="font-mono text-faint">{s.key}</span> {s.name}
                  </button>
                  <span className="flex gap-0.5">
                    <MiniButton onClick={() => move(s.key, -1)} disabled={i === 0}>
                      ↑
                    </MiniButton>
                    <MiniButton
                      onClick={() => move(s.key, 1)}
                      disabled={i === layout.shapes.length - 1}
                    >
                      ↓
                    </MiniButton>
                  </span>
                </li>
              ))}
              {layout.shapes.length === 0 ? (
                <li className="text-xs text-faint">Nothing drawn yet.</li>
              ) : null}
            </ul>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-faint">{mapName}</p>
        <button type="submit" className="btn btn-accent">
          Save venue
        </button>
      </div>
    </form>
  );
}

function boundsOf(s: Shape) {
  const g = s.geom;
  if (g.type === "rect") return { x: g.x, y: g.y, w: g.w, h: g.h };
  if (g.type === "ellipse") {
    return { x: g.cx - g.rx, y: g.cy - g.ry, w: g.rx * 2, h: g.ry * 2 };
  }
  const xs = g.points.map((p) => p.x);
  const ys = g.points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function ToolButton({
  on,
  onClick,
  label,
  title,
  disabled,
}: {
  on?: boolean;
  onClick: () => void;
  label: string;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        "rounded-brand border px-2.5 py-1 text-xs transition-colors disabled:opacity-40",
        on
          ? "border-accent bg-accent-soft text-fg"
          : "border-line text-muted hover:border-line-strong hover:text-fg",
      )}
    >
      {label}
    </button>
  );
}

function MiniButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-line px-1 leading-none text-faint transition-colors hover:text-fg disabled:opacity-30"
    >
      {children}
    </button>
  );
}

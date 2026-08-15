"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  emptyLayout,
  type Geom,
  type Shape,
  type ShapeKind,
  type VenueLayout,
} from "@/lib/venue/schema";
import { bounds, seatCapacity, totalSeats } from "@/lib/venue/seats";
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
//
// ---- Two coordinate spaces, and the one rule that keeps them honest -------
//
// LAYOUT space is what gets saved: every shape's geometry is in viewBox units. VIEW space is
// what is on screen right now - a window into layout space that pan and zoom move around.
// `view` ALWAYS keeps the layout's aspect ratio (view.w/view.h === viewBox.w/viewBox.h), so
// the SVG never letterboxes and `toLocal` can map a pixel straight back to a layout unit with
// no special cases. Break that invariant and every click lands in the wrong place.

const TOOLS: { kind: ShapeKind; label: string; hint: string }[] = [
  { kind: "STAGE", label: "Stage", hint: "The thing everyone is looking at. Sells nothing." },
  { kind: "SEATED_SECTION", label: "Seated block", hint: "Numbered rows and seats." },
  { kind: "STANDING_AREA", label: "Standing area", hint: "A pit or a gate. Capacity, no chairs." },
  { kind: "GATE", label: "Gate", hint: "An entrance. The door reads it." },
  { kind: "DECOR", label: "Decor", hint: "Bars, toilets, the desk. Means nothing." },
  { kind: "LABEL", label: "Label", hint: "Just text." },
];

type Tool = "select" | ShapeKind;

/**
 * WHAT you draw is one question; WHAT SHAPE it is, is another.
 *
 * Two knobs rather than eighteen buttons. Every kind can be any of the three geometries -
 * a curved balcony is a seated section drawn as a polygon, a circular pit is a standing area
 * drawn as an ellipse - and schema.ts and venue-map.tsx have supported all three since the
 * day they were written. Only the designer could not draw them.
 */
type GeomKind = "rect" | "ellipse" | "polygon";

const GEOMS: { kind: GeomKind; label: string; hint: string }[] = [
  { kind: "rect", label: "▭", hint: "Rectangle. Drag to draw." },
  { kind: "ellipse", label: "◯", hint: "Ellipse. Drag to draw. A round pit, an island stage." },
  {
    kind: "polygon",
    label: "⬠",
    hint: "Polygon. Click each corner; double-click or press Enter to close. A curved balcony is about 20 points.",
  },
];

const HISTORY_CAP = 50;

/** How far in you can zoom: the view window shrinks to no less than 1/MAX_ZOOM of the room. */
const MAX_ZOOM = 8;

const clampNum = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ---- Moving a drawn shape --------------------------------------------------
//
// Three geometries, three ways to be moved, and no way around writing all three - a rect has
// an origin, an ellipse has a centre, and a polygon has neither.

function translate(g: Geom, dx: number, dy: number): Geom {
  if (g.type === "rect") return { ...g, x: g.x + dx, y: g.y + dy };
  if (g.type === "ellipse") return { ...g, cx: g.cx + dx, cy: g.cy + dy };
  return { ...g, points: g.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
}

/**
 * Resize to a new bounding box, keeping the TOP-LEFT where it is.
 *
 * The polygon case SCALES its points rather than nudging them, which is the only sane
 * reading of "drag the corner of this balcony": the shape keeps its silhouette and changes
 * size. Guarded against a zero-width box, because dividing by it turns every point into NaN
 * and the shape vanishes with no way to get it back except undo.
 */
function resize(g: Geom, w: number, h: number): Geom {
  const b = bounds(g);

  if (g.type === "rect") return { ...g, w, h };

  if (g.type === "ellipse") {
    return { ...g, rx: w / 2, ry: h / 2, cx: b.x + w / 2, cy: b.y + h / 2 };
  }

  const sx = b.w > 0 ? w / b.w : 1;
  const sy = b.h > 0 ? h / b.h : 1;
  return {
    ...g,
    points: g.points.map((p) => ({
      x: b.x + (p.x - b.x) * sx,
      y: b.y + (p.y - b.y) * sy,
    })),
  };
}

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
  /**
   * The org this map belongs to: "" for RNL's own, a partner slug otherwise. It is the folder
   * a backdrop uploads into - passed to /api/uploads, which authorises it against the caller
   * (the string here proves nothing; see the route).
   */
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
  const [geomKind, setGeomKind] = useState<GeomKind>("rect");
  const [active, setActive] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<{ x: number; y: number } | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [poly, setPoly] = useState<{ x: number; y: number }[]>([]);

  // Snap is a toggle now (hold Alt to bypass it for one action). Grid SIZE lives in the
  // layout, because the map draws it and it is a property of the room, not of this session.
  const [snapEnabled, setSnapEnabled] = useState(true);

  // The pan/zoom window into layout space. Kept at the layout's aspect ratio always.
  const [view, setView] = useState({ x: 0, y: 0, w: layout.viewBox.w, h: layout.viewBox.h });
  const [spaceDown, setSpaceDown] = useState(false);

  // Backdrop upload state (the file goes to /api/uploads out of band; only its URL is saved
  // into the layout). `bgNatural` is the uploaded image's real pixel size, used by "Fit
  // canvas" - not persisted, just re-read from the image whenever the url changes.
  const [bgBusy, setBgBusy] = useState(false);
  const [bgError, setBgError] = useState<string | null>(null);
  const [bgNatural, setBgNatural] = useState<{ w: number; h: number } | null>(null);
  const [bgHidden, setBgHidden] = useState(false);

  /**
   * A shape being dragged, and the geometry it had BEFORE the drag started.
   *
   * The original is kept rather than accumulating deltas frame by frame, because
   * accumulating rounds against the grid on every mousemove and a shape dragged slowly
   * across the canvas would arrive somewhere its own arithmetic invented.
   */
  const [drag, setDrag] = useState<{
    key: string;
    mode: "move" | "resize";
    from: { x: number; y: number };
    geom: Geom;
  } | null>(null);

  const past = useRef<VenueLayout[]>([]);
  const future = useRef<VenueLayout[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bgFileRef = useRef<HTMLInputElement | null>(null);

  /** A pan in progress: where it began, in both spaces, frozen at mousedown. */
  const panRef = useRef<{
    sx: number;
    sy: number;
    vx: number;
    vy: number;
    rw: number;
    rh: number;
    vw: number;
    vh: number;
  } | null>(null);

  /**
   * The layout as it was when the drag began - pushed onto the undo stack when the drag
   * ENDS, and not before.
   *
   * A drag is ONE edit. Committing on every mousemove would push sixty layouts a second onto
   * the history and undo would walk back through the drag one pixel at a time, which is not
   * undo - it is a replay.
   */
  const beforeDrag = useRef<VenueLayout | null>(null);

  const commit = useCallback((next: VenueLayout) => {
    setLayout((prev) => {
      past.current = [...past.current.slice(-HISTORY_CAP + 1), prev];
      future.current = [];
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    setLayout((cur) => {
      future.current = [cur, ...future.current.slice(0, HISTORY_CAP - 1)];
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    const next = future.current.shift();
    if (!next) return;
    setLayout((cur) => {
      past.current = [...past.current, cur];
      return next;
    });
  }, []);

  // ---- The two coordinate spaces -----------------------------------------

  const grid = layout.grid || 10;

  /** Browser pixels -> layout units, through the current view window. Snaps unless the toggle
   *  is off or Alt is held for this one move. Without this, every shape lands in the wrong
   *  place - and it must read `view`, not the full viewBox, or clicks drift the moment you zoom. */
  const toLocal = (e: { clientX: number; clientY: number; altKey?: boolean }) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = view.x + ((e.clientX - rect.left) / rect.width) * view.w;
    const y = view.y + ((e.clientY - rect.top) / rect.height) * view.h;
    if (!snapEnabled || e.altKey) return { x, y };
    return { x: Math.round(x / grid) * grid, y: Math.round(y / grid) * grid };
  };

  // Keep the view a window of the current room. When the canvas size changes (Fit canvas), or
  // the room first loads, reset to show the whole thing.
  useEffect(() => {
    setView({ x: 0, y: 0, w: layout.viewBox.w, h: layout.viewBox.h });
  }, [layout.viewBox.w, layout.viewBox.h]);

  /** Zoom about a layout-space focal point, keeping that point under the same pixel. */
  const zoomAbout = useCallback(
    (fx: number, fy: number, factor: number) => {
      setView((v) => {
        const vbW = layout.viewBox.w;
        const vbH = layout.viewBox.h;
        const minW = vbW / MAX_ZOOM;
        const w = clampNum(v.w / factor, minW, vbW);
        const h = w * (vbH / vbW);
        // Fraction of the window the focal point sat at, held constant across the zoom.
        const rx = (fx - v.x) / v.w;
        const ry = (fy - v.y) / v.h;
        const x = clampNum(fx - rx * w, 0, Math.max(0, vbW - w));
        const y = clampNum(fy - ry * h, 0, Math.max(0, vbH - h));
        return { x, y, w, h };
      });
    },
    [layout.viewBox.w, layout.viewBox.h],
  );

  /** Zoom from a button: focal point is the centre of what is on screen. */
  const zoomFromButton = (factor: number) =>
    zoomAbout(view.x + view.w / 2, view.y + view.h / 2, factor);

  const resetView = () =>
    setView({ x: 0, y: 0, w: layout.viewBox.w, h: layout.viewBox.h });

  // Wheel to zoom, toward the cursor. A NATIVE non-passive listener, because React's onWheel
  // cannot preventDefault the page scroll - so without this the whole page scrolls while you
  // are trying to zoom the map.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setView((v) => {
        const fx = v.x + ((e.clientX - rect.left) / rect.width) * v.w;
        const fy = v.y + ((e.clientY - rect.top) / rect.height) * v.h;
        const vbW = layout.viewBox.w;
        const vbH = layout.viewBox.h;
        const w = clampNum(v.w / factor, vbW / MAX_ZOOM, vbW);
        const h = w * (vbH / vbW);
        const rx = (fx - v.x) / v.w;
        const ry = (fy - v.y) / v.h;
        return {
          x: clampNum(fx - rx * w, 0, Math.max(0, vbW - w)),
          y: clampNum(fy - ry * h, 0, Math.max(0, vbH - h)),
          w,
          h,
        };
      });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [layout.viewBox.w, layout.viewBox.h]);

  // ---- Editing primitives ------------------------------------------------

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

  const patch = (key: string, next: Partial<Shape>) =>
    commit({
      ...layout,
      shapes: layout.shapes.map((s) => (s.key === key ? ({ ...s, ...next } as Shape) : s)),
    });

  const remove = useCallback(
    (key: string) => {
      commit({ ...layout, shapes: layout.shapes.filter((s) => s.key !== key) });
      setActive(null);
    },
    [commit, layout],
  );

  const move = useCallback(
    (key: string, by: number) => {
      const i = layout.shapes.findIndex((s) => s.key === key);
      const j = i + by;
      if (i < 0 || j < 0 || j >= layout.shapes.length) return;
      const shapes = [...layout.shapes];
      [shapes[i], shapes[j]] = [shapes[j], shapes[i]];
      commit({ ...layout, shapes });
    },
    [commit, layout],
  );

  /** Shift a shape by a whole step. One history entry - see beforeDrag for why that matters. */
  const nudge = useCallback(
    (key: string, dx: number, dy: number) =>
      commit({
        ...layout,
        shapes: layout.shapes.map((s) =>
          s.key === key ? ({ ...s, geom: translate(s.geom, dx, dy) } as Shape) : s,
        ),
      }),
    [commit, layout],
  );

  /**
   * Duplicate the selected shape, offset by a grid square, with a fresh key.
   *
   * The clone is a DEEP copy (JSON round-trip): a seated block's `rows` and a polygon's
   * `points` are nested objects, and a shallow spread would leave the copy sharing them with
   * the original - so editing one would silently edit the other. The key is regenerated
   * because a key is a ticket's forever-pointer (see SECTION_KEY) and must be unique.
   */
  const duplicateActive = useCallback(() => {
    if (!active) return;
    const src = layout.shapes.find((s) => s.key === active);
    if (!src) return;
    const key = freshKey(layout, src.kind);
    const off = snapEnabled ? grid : 10;
    const copy = {
      ...(JSON.parse(JSON.stringify(src)) as Shape),
      key,
      name: `${src.name} copy`.slice(0, 60),
      geom: translate(src.geom, off, off),
      z: layout.shapes.length,
    } as Shape;
    commit({ ...layout, shapes: [...layout.shapes, copy] });
    setActive(key);
  }, [active, commit, grid, layout, snapEnabled]);

  /** Finish the polygon in progress. Needs three points - two is a line, and zod says no. */
  const closePolygon = useCallback(() => {
    if (tool === "select" || poly.length < 3) return;
    addShape(tool as ShapeKind, { type: "polygon", points: poly });
    setPoly([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, poly, layout]);

  // ---- Keyboard -----------------------------------------------------------
  //
  // One listener for everything. It bows out the moment focus is in a text field, so typing a
  // section name never deletes the section. Space is tracked here too, for pan (see below).

  useEffect(() => {
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return (
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // The polygon in progress owns Enter and Escape while it lasts.
      if (poly.length) {
        if (e.key === "Enter") {
          e.preventDefault();
          closePolygon();
          return;
        }
        if (e.key === "Escape") {
          setPoly([]);
          return;
        }
      }

      if (e.key === " " && !isTyping(e.target)) {
        // Space = hold to pan. preventDefault so it doesn't scroll the page or click a button.
        e.preventDefault();
        setSpaceDown(true);
        return;
      }

      if (isTyping(e.target)) return;

      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();

      if (mod && k === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if (mod && k === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && k === "d") {
        e.preventDefault();
        duplicateActive();
        return;
      }

      if (e.key === "Escape") {
        setTool("select");
        setActive(null);
        setDrawing(null);
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && active) {
        e.preventDefault();
        remove(active);
        return;
      }

      // Nudge the selection. Shift = five steps. Alt-less, so it always snaps to the grid step.
      if (active && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = (snapEnabled ? grid : 1) * (e.shiftKey ? 5 : 1);
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        nudge(active, dx, dy);
        return;
      }

      // Re-order in the offered list (= best-available order). [ earlier, ] later.
      if (active && (e.key === "[" || e.key === "]")) {
        move(active, e.key === "[" ? -1 : 1);
        return;
      }

      if (k === "v") setTool("select");
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") setSpaceDown(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poly, active, tool, layout, snapEnabled, grid, closePolygon, undo, redo, duplicateActive, remove, move, nudge]);

  // ---- Drawing ------------------------------------------------------------

  const beginPan = (e: React.MouseEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    panRef.current = {
      sx: e.clientX,
      sy: e.clientY,
      vx: view.x,
      vy: view.y,
      rw: rect.width,
      rh: rect.height,
      vw: view.w,
      vh: view.h,
    };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    // Pan takes precedence over everything: space-drag, or the middle mouse button.
    if (spaceDown || e.button === 1) {
      e.preventDefault();
      beginPan(e);
      return;
    }

    if (tool === "select") return;
    const p = toLocal(e);
    if (!p) return;

    if (tool === "LABEL") {
      addShape("LABEL", { type: "rect", x: p.x, y: p.y, w: 80, h: 20, rotation: 0 });
      return;
    }

    // A polygon is CLICKED, not dragged - one point per click, closed with Enter or a
    // double-click. Dragging cannot express it: a curved balcony is twenty points, and no
    // amount of dragging a rubber band will ever produce one.
    if (geomKind === "polygon") {
      setPoly((pts) => [...pts, p]);
      return;
    }

    setDrawing(p);
  };

  const onMouseUp = (e: React.MouseEvent) => {
    if (panRef.current) {
      panRef.current = null;
      return;
    }

    // A drag that was moving or resizing an existing shape. The layout is already correct -
    // it has been updated on every mousemove - so all that is left is to record the ONE
    // history entry the whole drag is worth.
    if (drag) {
      const before = beforeDrag.current;
      if (before) {
        past.current = [...past.current.slice(-HISTORY_CAP + 1), before];
        future.current = [];
      }
      setDrag(null);
      beforeDrag.current = null;
      return;
    }

    if (!drawing || tool === "select") return;
    const p = toLocal(e);
    setDrawing(null);
    if (!p) return;

    const x = Math.min(drawing.x, p.x);
    const y = Math.min(drawing.y, p.y);
    const w = Math.max(Math.abs(p.x - drawing.x), grid * 6);
    const h = Math.max(Math.abs(p.y - drawing.y), grid * 4);

    // A click, not a drag. Give them a default-sized block rather than a zero-area shape
    // that zod will reject and that they cannot see to delete.
    addShape(
      tool as ShapeKind,
      geomKind === "ellipse"
        ? {
            type: "ellipse",
            cx: x + w / 2,
            cy: y + h / 2,
            rx: w / 2,
            ry: h / 2,
            rotation: 0,
          }
        : { type: "rect", x, y, w, h, rotation: 0 },
    );
  };

  /** Grab a drawn shape. `mode` is which corner they took hold of. */
  const onShapeDown = (
    e: React.MouseEvent,
    shape: Shape,
    mode: "move" | "resize",
  ) => {
    // While panning, a shape is just scenery to drag the canvas over - let the click bubble to
    // the canvas's pan handler instead of grabbing the shape.
    if (spaceDown || e.button === 1) return;

    // Without this the canvas below starts drawing a NEW shape underneath the one they are
    // dragging, and they end up with a stack of accidental rectangles.
    e.stopPropagation();

    const p = toLocal(e);
    if (!p) return;

    setActive(shape.key);
    beforeDrag.current = layout;
    setDrag({ key: shape.key, mode, from: p, geom: shape.geom });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    // A pan in flight: move the window the opposite way to the cursor, so the room appears to
    // follow the hand. Clamped so the drawing can never be lost off an edge.
    if (panRef.current) {
      const pr = panRef.current;
      const vbW = layout.viewBox.w;
      const vbH = layout.viewBox.h;
      const nx = clampNum(pr.vx - ((e.clientX - pr.sx) / pr.rw) * pr.vw, 0, Math.max(0, vbW - pr.vw));
      const ny = clampNum(pr.vy - ((e.clientY - pr.sy) / pr.rh) * pr.vh, 0, Math.max(0, vbH - pr.vh));
      setView({ x: nx, y: ny, w: pr.vw, h: pr.vh });
      return;
    }

    const p = toLocal(e);
    if (!p) return;

    // The rubber band, and the line running out to the next polygon point.
    if (drawing || poly.length) setCursor(p);

    if (!drag) return;

    const dx = p.x - drag.from.x;
    const dy = p.y - drag.from.y;

    const b = bounds(drag.geom);
    const next =
      drag.mode === "move"
        ? translate(drag.geom, dx, dy)
        : resize(
            drag.geom,
            // Never smaller than one grid square. A shape dragged to zero width is a shape
            // you cannot see, cannot click, and cannot get back.
            Math.max(grid, b.w + dx),
            Math.max(grid, b.h + dy),
          );

    // setLayout, NOT commit - the history entry is written once, at mouseup. See beforeDrag.
    setLayout((l) => ({
      ...l,
      shapes: l.shapes.map((s) =>
        s.key === drag.key ? ({ ...s, geom: next } as Shape) : s,
      ),
    }));
  };

  // ---- The backdrop -------------------------------------------------------

  /** Read the uploaded image's real size, for Fit canvas. Runs whenever the url changes. */
  useEffect(() => {
    const url = layout.backdrop?.url;
    if (!url) {
      setBgNatural(null);
      return;
    }
    const img = new window.Image();
    let live = true;
    img.onload = () => {
      if (live) setBgNatural({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      if (live) setBgNatural(null);
    };
    img.src = url;
    return () => {
      live = false;
    };
  }, [layout.backdrop?.url]);

  async function uploadBackdrop(file: File) {
    setBgBusy(true);
    setBgError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      // "" = RNL's own; a slug uploads into that partner's folder. The route re-checks it.
      if (scope) body.append("partner", scope);

      const res = await fetch("/api/uploads", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setBgError(data.error ?? "That didn't upload. Try again.");
        return;
      }

      // Keep the current opacity if there already was a backdrop; otherwise a sensible default.
      commit({
        ...layout,
        backdrop: { url: data.url, opacity: layout.backdrop?.opacity ?? 0.6 },
      });
    } catch {
      setBgError("That didn't upload - check your connection and try again.");
    } finally {
      setBgBusy(false);
      if (bgFileRef.current) bgFileRef.current.value = "";
    }
  }

  const setBackdropOpacity = (opacity: number) => {
    if (!layout.backdrop) return;
    // setLayout, not commit: opacity is a display nudge, not worth a slot in undo history.
    setLayout((l) =>
      l.backdrop ? { ...l, backdrop: { ...l.backdrop, opacity } } : l,
    );
  };

  const removeBackdrop = () => commit({ ...layout, backdrop: null });

  /**
   * Resize the CANVAS to the backdrop's aspect ratio, so a traced diagram isn't stretched.
   *
   * Width is held and height is derived from the image, both clamped to the schema's bounds.
   * It changes where existing shapes sit RELATIVE to the new canvas, so it is only offered as
   * a deliberate button - and it is the first thing you press on a fresh room, before drawing.
   */
  const fitCanvasToImage = () => {
    if (!bgNatural || bgNatural.w <= 0) return;
    const w = clampNum(Math.round(layout.viewBox.w), 100, 10_000);
    const h = clampNum(Math.round(w * (bgNatural.h / bgNatural.w)), 100, 10_000);
    commit({ ...layout, viewBox: { w, h } });
  };

  // ---- Derived ------------------------------------------------------------

  const tierIndex = useMemo(
    () => new Map(tiers.map((t, i) => [t.id, i] as const)),
    [tiers],
  );

  const activeShape = layout.shapes.find((s) => s.key === active) ?? null;
  const seats = totalSeats(layout);
  const zoomPct = Math.round((layout.viewBox.w / view.w) * 100);

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

  const viewBoxStr = `${view.x} ${view.y} ${view.w} ${view.h}`;
  const canvasCursor = spaceDown
    ? panRef.current
      ? "grabbing"
      : "grab"
    : tool === "select"
      ? "default"
      : "crosshair";

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
              title="V · move and resize. Space or middle-drag to pan; scroll to zoom."
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

            {/* The SHAPE, which is a different question from the KIND. A curved balcony is a
                seated section drawn as a polygon; a round pit is a standing area drawn as an
                ellipse. Two knobs, not eighteen buttons. */}
            {GEOMS.map((g) => (
              <ToolButton
                key={g.kind}
                on={geomKind === g.kind}
                onClick={() => {
                  setGeomKind(g.kind);
                  setPoly([]);
                }}
                label={g.label}
                title={g.hint}
                disabled={tool === "select"}
              />
            ))}

            <span className="mx-1 h-5 w-px bg-line" />

            <ToolButton onClick={undo} label="Undo" title="Ctrl+Z" disabled={!past.current.length} />
            <ToolButton onClick={redo} label="Redo" title="Ctrl+Shift+Z" disabled={!future.current.length} />
            <ToolButton
              onClick={duplicateActive}
              label="Duplicate"
              title="Ctrl+D"
              disabled={!active}
            />
          </div>

          {/* View + snap controls. */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <ToolButton onClick={() => zoomFromButton(1 / 1.25)} label="−" title="Zoom out" />
            <span className="w-12 text-center font-mono text-faint">{zoomPct}%</span>
            <ToolButton onClick={() => zoomFromButton(1.25)} label="+" title="Zoom in" />
            <ToolButton onClick={resetView} label="Fit view" title="Show the whole room" />

            <span className="mx-1 h-5 w-px bg-line" />

            <label className="flex items-center gap-1.5 text-faint">
              <input
                type="checkbox"
                checked={snapEnabled}
                onChange={(e) => setSnapEnabled(e.target.checked)}
                className="accent-[rgb(var(--accent-rgb))]"
              />
              Snap
            </label>
            <label className="flex items-center gap-1.5 text-faint">
              Grid
              <select
                value={grid}
                onChange={(e) => commit({ ...layout, grid: +e.target.value })}
                className="rounded-brand border border-line bg-bg px-1.5 py-0.5 text-xs outline-none focus:border-accent"
              >
                {[5, 10, 20, 25, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-brand border border-line bg-bg"
            style={{ aspectRatio: `${layout.viewBox.w} / ${layout.viewBox.h}` }}
          >
            <svg
              ref={svgRef}
              viewBox={viewBoxStr}
              className="absolute inset-0 h-full w-full"
              style={{ cursor: canvasCursor }}
              onMouseDown={onMouseDown}
              onMouseUp={onMouseUp}
            />
            <div className="pointer-events-none absolute inset-0">
              <VenueMap
                layout={layout}
                tierIndex={tierIndex}
                showGrid
                showBackdrop={!bgHidden}
                view={view}
                activeShape={active}
                focused={activeShape?.kind === "SEATED_SECTION" ? active : null}
              />
            </div>
            {/* The click layer sits ON TOP so section clicks reach the designer, not the
                map's own buyer-facing handlers. */}
            <svg
              viewBox={viewBoxStr}
              className="absolute inset-0 h-full w-full"
              onMouseDown={onMouseDown}
              onMouseUp={onMouseUp}
              onMouseMove={onMouseMove}
              // A pointer that leaves the canvas mid-drag would otherwise leave the shape
              // stuck to it: no mouseup ever arrives, and the next move - anywhere on the
              // page - is still dragging.
              onMouseLeave={() => {
                if (panRef.current) panRef.current = null;
                if (drag) onMouseUp({} as React.MouseEvent);
                setDrawing(null);
                setCursor(null);
              }}
              onDoubleClick={closePolygon}
              style={{ cursor: canvasCursor }}
            >
              {tool === "select" && !spaceDown
                ? layout.shapes.map((s) => {
                    const b = boundsOf(s);
                    const isActive = active === s.key;
                    // Handle size in layout units, shrunk as you zoom in so it stays a sane
                    // number of pixels rather than swelling to cover the shape.
                    const handle = Math.max(4, (grid * view.w) / layout.viewBox.w);

                    return (
                      <g key={s.key}>
                        {/* The body. Grab it anywhere to move it. */}
                        <rect
                          x={b.x}
                          y={b.y}
                          width={b.w}
                          height={b.h}
                          fill="transparent"
                          style={{ cursor: drag ? "grabbing" : "grab" }}
                          onMouseDown={(e) => onShapeDown(e, s, "move")}
                        />

                        {/* The resize handle, on the selected shape only - a canvas with a
                            grab handle on every block is a canvas you cannot click. */}
                        {isActive ? (
                          <rect
                            x={b.x + b.w - handle / 2}
                            y={b.y + b.h - handle / 2}
                            width={handle}
                            height={handle}
                            fill="rgb(var(--accent-rgb))"
                            stroke="rgb(var(--bg-rgb))"
                            strokeWidth={1}
                            style={{ cursor: "nwse-resize" }}
                            onMouseDown={(e) => onShapeDown(e, s, "resize")}
                          />
                        ) : null}
                      </g>
                    );
                  })
                : null}

              {/* The rubber band. There was none, so drawing a block was an act of faith. */}
              {drawing && cursor && geomKind !== "polygon" ? (
                geomKind === "ellipse" ? (
                  <ellipse
                    cx={(drawing.x + cursor.x) / 2}
                    cy={(drawing.y + cursor.y) / 2}
                    rx={Math.abs(cursor.x - drawing.x) / 2}
                    ry={Math.abs(cursor.y - drawing.y) / 2}
                    fill="rgb(var(--accent-rgb) / 0.15)"
                    stroke="rgb(var(--accent-rgb))"
                    strokeDasharray="4 3"
                  />
                ) : (
                  <rect
                    x={Math.min(drawing.x, cursor.x)}
                    y={Math.min(drawing.y, cursor.y)}
                    width={Math.abs(cursor.x - drawing.x)}
                    height={Math.abs(cursor.y - drawing.y)}
                    fill="rgb(var(--accent-rgb) / 0.15)"
                    stroke="rgb(var(--accent-rgb))"
                    strokeDasharray="4 3"
                  />
                )
              ) : null}

              {/* The polygon in progress: the points so far, and a line out to the cursor. */}
              {poly.length ? (
                <>
                  <polyline
                    points={[...poly, cursor ?? poly[poly.length - 1]]
                      .map((p) => `${p.x},${p.y}`)
                      .join(" ")}
                    fill="rgb(var(--accent-rgb) / 0.12)"
                    stroke="rgb(var(--accent-rgb))"
                    strokeDasharray="4 3"
                  />
                  {poly.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={Math.max(2, (grid / 3) * (view.w / layout.viewBox.w))}
                      fill="rgb(var(--accent-rgb))"
                    />
                  ))}
                </>
              ) : null}
            </svg>
          </div>

          <p className="text-xs text-faint">
            {spaceDown
              ? "Drag to pan. Let go of Space to draw or select."
              : tool === "select"
                ? "Click a shape to move it. Drag the corner to resize. Arrows nudge · Ctrl+D duplicates · Del removes. Scroll to zoom, Space or middle-drag to pan."
                : geomKind === "polygon"
                  ? `Click each corner. ${poly.length >= 3 ? "Double-click or press Enter to close it" : "Three points minimum"} · Esc to start over.`
                  : "Drag on the canvas to draw. Hold Alt to ignore the grid."}
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

          {/* ---- Backdrop: upload a diagram and trace over it ------------- */}
          <div className="card space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm">Backdrop</h3>
              {layout.backdrop ? (
                <button
                  type="button"
                  onClick={() => setBgHidden((h) => !h)}
                  className="text-xs text-faint transition-colors hover:text-fg"
                >
                  {bgHidden ? "Show" : "Hide"}
                </button>
              ) : null}
            </div>

            <p className="text-xs text-faint">
              Upload a stage diagram or seating plan and draw the room over it. It&apos;s a
              tracing guide only - buyers never see it.
            </p>

            {layout.backdrop ? (
              <>
                <div className="overflow-hidden rounded-brand border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={layout.backdrop.url}
                    alt="Backdrop"
                    className="max-h-32 w-full object-contain bg-bg"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-faint">
                    Opacity · {Math.round(layout.backdrop.opacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={layout.backdrop.opacity}
                    onChange={(e) => setBackdropOpacity(+e.target.value)}
                    className="h-1 w-full cursor-pointer accent-[rgb(var(--accent-rgb))]"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => bgFileRef.current?.click()}
                    disabled={bgBusy}
                    className="btn btn-ghost !py-1.5 !px-3 text-xs disabled:opacity-50"
                  >
                    {bgBusy ? "Uploading…" : "Replace"}
                  </button>
                  <button
                    type="button"
                    onClick={fitCanvasToImage}
                    disabled={!bgNatural}
                    className="btn btn-ghost !py-1.5 !px-3 text-xs disabled:opacity-40"
                    title="Match the canvas shape to the image, so tracing isn't distorted."
                  >
                    Fit canvas
                  </button>
                  <button
                    type="button"
                    onClick={removeBackdrop}
                    className="text-xs text-faint transition-colors hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => bgFileRef.current?.click()}
                disabled={bgBusy}
                className="btn btn-ghost w-full !py-2 text-xs disabled:opacity-50"
              >
                {bgBusy ? "Uploading…" : "Upload a diagram"}
              </button>
            )}

            <input
              ref={bgFileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadBackdrop(file);
              }}
            />

            {bgError ? <p className="text-xs text-red-400">{bgError}</p> : null}
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

/**
 * The box a shape sits in.
 *
 * Was a hand-written copy of bounds() in lib/venue/seats.ts - the same three cases, the same
 * arithmetic, written out twice. It is one call now, for the reason seats.ts states at the
 * top of itself: two implementations of one fact agree right up until somebody changes one of
 * them, and then the designer's idea of where a shape is stops matching the allocator's.
 */
function boundsOf(s: Shape) {
  return bounds(s.geom);
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

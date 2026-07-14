"use client";

import type { Shape } from "@/lib/venue/schema";

// One shape's properties.
//
// Deliberately does NOT have a world-anchor field. The anchor is ONE thing on the whole
// map, not six floats per section - see the long note at the top of lib/venue/anchor.ts.
// Six hand-typed numbers per section, in a 2D editor that cannot show you whether they are
// right, would be wrong, and would be wrong silently: the map looks perfect and players
// spawn inside a wall.

const inputClass =
  "w-full rounded-brand border border-line bg-bg px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-accent";
const labelClass =
  "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-faint";

export function ShapeInspector({
  shape,
  tiers,
  seats,
  onChange,
  onDelete,
  onMove,
}: {
  shape: Shape;
  tiers: { id: string; name: string; priceRobux: number }[];
  /** Live seat count for a seated block - so the rake/curve numbers mean something. */
  seats: number | null;
  onChange: (next: Partial<Shape>) => void;
  onDelete: () => void;
  onMove: (by: number) => void;
}) {
  const sellable =
    shape.kind === "SEATED_SECTION" || shape.kind === "STANDING_AREA";

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm">
          {shape.name}{" "}
          <span className="font-mono text-xs text-faint">{shape.key}</span>
        </h3>
        <button
          type="button"
          onClick={onDelete}
          className="text-xs text-faint transition-colors hover:text-red-400"
        >
          Delete
        </button>
      </div>

      <div>
        <label className={labelClass}>Name</label>
        <input
          value={shape.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className={inputClass}
        />
        <p className="mt-1 text-[10px] text-faint">
          Rename freely. The KEY ({shape.key}) is what tickets point at, and it never
          changes.
        </p>
      </div>

      {/* Rotation, for rects and ellipses. A polygon carries its rotation in its points -
          you turn one by dragging its corners - so it has no single angle to set here. The
          seat grid and the outline are spun about the same centre (see venue-map.tsx), so a
          turned block's chairs turn with it. */}
      {shape.geom.type !== "polygon" ? (
        <div>
          <label className={labelClass}>Rotation · {Math.round(shape.geom.rotation)}°</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={shape.geom.rotation}
              onChange={(e) =>
                onChange({
                  geom: { ...shape.geom, rotation: clamp(+e.target.value, -180, 180) },
                } as Partial<Shape>)
              }
              className="h-1 flex-1 cursor-pointer accent-[rgb(var(--accent-rgb))]"
            />
            <input
              type="number"
              min={-180}
              max={180}
              value={Math.round(shape.geom.rotation)}
              onChange={(e) =>
                onChange({
                  geom: { ...shape.geom, rotation: clamp(+e.target.value, -180, 180) },
                } as Partial<Shape>)
              }
              className={inputClass + " w-16"}
            />
          </div>
        </div>
      ) : null}

      {sellable ? (
        <div>
          <label className={labelClass}>Tier</label>
          <select
            value={shape.tierId ?? ""}
            onChange={(e) => onChange({ tierId: e.target.value || null } as Partial<Shape>)}
            className={inputClass}
          >
            <option value="">— no tier —</option>
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.priceRobux > 0 ? ` · ${t.priceRobux} R$` : " · Free"}
              </option>
            ))}
          </select>
          {tiers.length === 0 ? (
            <p className="mt-1 text-[10px] text-faint">
              This is a template, so it has no tiers to assign. You&apos;ll pick them on
              the event&apos;s own copy.
            </p>
          ) : null}
        </div>
      ) : null}

      {shape.kind === "STANDING_AREA" ? (
        <div>
          <label className={labelClass}>Capacity</label>
          <input
            type="number"
            min={0}
            value={shape.capacity}
            onChange={(e) =>
              onChange({ capacity: Math.max(0, +e.target.value || 0) } as Partial<Shape>)
            }
            className={inputClass}
          />
          <p className="mt-1 text-[10px] text-faint">
            0 = uncapped by the area. The tier&apos;s cap and the room&apos;s still apply.
          </p>
        </div>
      ) : null}

      {shape.kind === "SEATED_SECTION" ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Rows</label>
              <input
                type="number"
                min={1}
                max={60}
                value={shape.rows.rows}
                onChange={(e) =>
                  onChange({
                    rows: { ...shape.rows, rows: clamp(+e.target.value, 1, 60) },
                  } as Partial<Shape>)
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Seats / row</label>
              <input
                type="number"
                min={1}
                max={80}
                value={shape.rows.seatsPerRow}
                onChange={(e) =>
                  onChange({
                    rows: { ...shape.rows, seatsPerRow: clamp(+e.target.value, 1, 80) },
                  } as Partial<Shape>)
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>First row</label>
              <input
                value={shape.rows.rowLabelStart}
                onChange={(e) =>
                  onChange({
                    rows: {
                      ...shape.rows,
                      rowLabelStart: e.target.value.toUpperCase().slice(0, 2) || "A",
                    },
                  } as Partial<Shape>)
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>First seat no.</label>
              <input
                type="number"
                min={0}
                value={shape.rows.seatStart}
                onChange={(e) =>
                  onChange({
                    rows: { ...shape.rows, seatStart: clamp(+e.target.value, 0, 999) },
                  } as Partial<Shape>)
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Rake</label>
              <input
                type="number"
                value={shape.rows.rake}
                onChange={(e) =>
                  onChange({
                    rows: { ...shape.rows, rake: clamp(+e.target.value, -50, 50) },
                  } as Partial<Shape>)
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Curve</label>
              <input
                type="number"
                value={shape.rows.curve}
                onChange={(e) =>
                  onChange({
                    rows: { ...shape.rows, curve: clamp(+e.target.value, -200, 200) },
                  } as Partial<Shape>)
                }
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Missing seats</label>
            <input
              value={shape.rows.skips.join(", ")}
              onChange={(e) =>
                onChange({
                  rows: {
                    ...shape.rows,
                    skips: e.target.value
                      .split(/[,\s]+/)
                      .map((s) => s.trim().toUpperCase())
                      .filter(Boolean)
                      .slice(0, 400),
                  },
                } as Partial<Shape>)
              }
              placeholder="K12, K13"
              className={inputClass}
            />
            <p className="mt-1 text-[10px] text-faint">
              An aisle, a pillar, a camera position. These chairs don&apos;t exist - they
              are not &quot;sold out&quot;.
            </p>
          </div>

          <p className="rounded-brand border border-line px-3 py-2 text-xs text-muted">
            <span className="font-mono text-fg">{seats}</span> seats in this block.
          </p>
        </div>
      ) : null}

      <div className="flex items-center gap-2 border-t border-line pt-3">
        <button
          type="button"
          onClick={() => onMove(-1)}
          className="btn btn-ghost flex-1 py-1 text-xs"
        >
          Offer earlier
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          className="btn btn-ghost flex-1 py-1 text-xs"
        >
          Offer later
        </button>
      </div>
    </div>
  );
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Math.round(n || 0)));

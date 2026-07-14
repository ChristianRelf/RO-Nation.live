import { cn } from "@/lib/utils";

/**
 * The job docket: a mono, hairline-ruled spec table.
 *
 * This is the answer to a null `description`, and `description` is null for most
 * products - Roblox's own descriptions are usually a bare tag list or nothing at all.
 * A product page whose right-hand column is a heading, a price and then white space
 * looks half-built, and no amount of art direction fixes that; only content does.
 *
 * So the docket is built ONLY from fields that cannot be null - kind, assetId,
 * status - plus the ones that degrade honestly. It always has something to say, which
 * means the column is always full, which means the page is never embarrassing.
 *
 * A row whose value is null is DROPPED, never rendered empty. A docket with four rows
 * still reads as a docket; a docket with a blank line reads as a bug.
 */

export type Row = {
  label: string;
  value: string | null;
  /** Draws the value in the accent - for the one row that is the answer. */
  loud?: boolean;
};

export function Docket({
  rows,
  className,
}: {
  rows: Row[];
  className?: string;
}) {
  const live = rows.filter((r) => r.value !== null);
  if (!live.length) return null;

  return (
    <dl
      className={cn(
        "border-t border-line font-mono text-[11px] uppercase tracking-[0.08em]",
        className,
      )}
    >
      {live.map((r) => (
        <div
          key={r.label}
          className="flex items-baseline justify-between gap-6 border-b border-line py-2.5"
        >
          <dt className="text-faint">{r.label}</dt>
          <dd
            className={cn(
              "tabular-nums text-right",
              r.loud ? "text-accent" : "text-fg",
            )}
          >
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

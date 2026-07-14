import { cn } from "@/lib/utils";

// The furniture of a merch table: the bar, the stamp, the tag, the empty hanger.
//
// Small, dumb, server-rendered, and gathered in one file because they are one idea:
// the physical objects the shop is built out of. Every one of them is drawn from
// rules, masks and type - never from a filled box - because sleeptokenro.css sets
// `.card { background: transparent }`, and anything defined by a fill would simply
// vanish on that shelf.

/**
 * The scaffold pole things hang from.
 *
 * The brackets at each end are what stop it reading as a border-bottom somebody made
 * slightly too thick. On Sleep Token the brand file deletes them and thins the bar to
 * a hairline: scaffolding becomes wire.
 */
export function RailBar({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative flex items-start", className)}>
      <span className="rail-bracket shrink-0" />
      <span className="rail-bar flex-1" />
      <span className="rail-bracket shrink-0 -scale-x-100" />
    </div>
  );
}

/**
 * A rubber stamp, overprinted.
 *
 * ALWAYS aria-hidden, and that is not laziness - it is the rule. A stamp is a
 * duplicate of something the page already says in text (the tag prints "Off sale",
 * the docket's STATUS row prints it, the link's accessible name carries it). Reading
 * it out again is noise; and no meaning in this shop is ever carried by a stamp
 * alone, so hiding it costs a screen-reader user nothing.
 */
export function Stamp({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "ticket-stamp pointer-events-none select-none text-sm",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * The swing tag: a paper tag pinned on by hand, hanging from a string through a
 * punched hole.
 *
 * The hole is cut with a mask (see .tag in globals.css), so the shadow underneath it
 * is a drop-shadow filter and never a box-shadow - a box-shadow is the shadow of the
 * element's BOX and would paint straight through the hole.
 */
export function SwingTag({
  label,
  muted,
  rot,
  className,
}: {
  label: string;
  /** Off sale / not for sale: the tag still prints, it just is not the loud one. */
  muted?: boolean;
  rot?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("tag inline-block panel-paper px-3 py-2 pl-6", className)}
      style={{ "--tag-rot": `${rot ?? 3}deg` } as React.CSSProperties}
    >
      {/* The hole's rim. The mask has already punched the hole; this is the ring of
          card around it. */}
      <span
        aria-hidden
        className="absolute left-[8px] top-[4px] h-2 w-2 rounded-full border border-paper-ink/30"
      />
      <span
        className={cn(
          "block font-mono text-[13px] font-bold tabular-nums tracking-tight",
          muted ? "text-paper-ink/55" : "text-paper-ink",
        )}
      >
        {label}
      </span>
    </span>
  );
}

/**
 * A bare hook and shoulder bar: a hanger with nothing on it.
 *
 * The empty state, everywhere in this shop. An empty rail is not an error and must
 * not look like one - a merch table at 2am has empty hangers on it, and that reads as
 * "sold out / not yet" rather than as "this page is broken". It is the same reason
 * the 404 keeps the collection list.
 */
export function EmptyHanger({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex flex-col items-center", className)}>
      <Hook />
      <div className="mt-1 h-[3px] w-24 rounded-brand bg-line-strong" />
    </div>
  );
}

/** The wire hook itself. Drawn, not an icon font, so it inherits currentColor. */
export function Hook({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 24"
      className={cn("h-6 w-5 text-line-strong", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      {/* A shepherd's crook: over the bar, and down. */}
      <path d="M10 24V10" />
      <path d="M10 10c0-4 5-4 5-7a3 3 0 0 0-5-2" />
    </svg>
  );
}

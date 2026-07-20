import { HubAnchor } from "./hub-anchor";

// The hub's control vocabulary.
//
// The portal's global .btn is a poster CTA - big, squared, inverting on hover. It
// is right at the bottom of a marketing page and wrong here, where a single view
// carries a dozen destinations and one of them is the point. So the hub has three
// weights of its own, and the weight IS the ranking:
//
//   HubButton accent  - the one thing to do next. At most one per block.
//   HubButton ghost   - a real destination, but not the one being recommended.
//   HubChip           - somewhere you might go. Many per block, deliberately quiet.
//   HubFlag           - something wrong. Not a destination, a summons.
//
// All four share one hover: a fill that WIPES from the left edge rather than
// cross-fading. It reads as a thing being selected rather than a thing lighting
// up, which is the difference between a control surface and a web page - and it
// costs one transform, so it stays on the compositor.
//
// Everything routes through HubAnchor. Half the hub's links cross a host boundary
// and next/link cannot follow them; see the note in hub-anchor.tsx.

/** The wiping fill. -z-10 against the isolate on each control's own stacking context. */
const WIPE =
  "absolute inset-0 -z-10 origin-left scale-x-0 transition-transform duration-300 ease-settle group-hover:scale-x-100";

const BASE =
  "group relative isolate inline-flex items-center gap-2 overflow-hidden transition-colors duration-200";

function Arrow({ external }: { external?: boolean }) {
  return (
    <span
      aria-hidden
      className="transition-transform duration-300 ease-settle group-hover:translate-x-0.5"
    >
      {external ? "↗" : "→"}
    </span>
  );
}

export function HubButton({
  href,
  external,
  variant = "ghost",
  children,
  className = "",
}: {
  href: string;
  external?: boolean;
  variant?: "accent" | "ghost";
  children: React.ReactNode;
  className?: string;
}) {
  const accent = variant === "accent";

  return (
    <HubAnchor
      href={href}
      external={external}
      className={`${BASE} rounded-brand border px-5 py-2.5 text-[11px] font-bold uppercase tracking-kicker ${
        accent
          ? "border-accent bg-accent text-accent-ink group-hover:text-bg hover:text-bg"
          : "border-line-strong text-fg hover:border-accent hover:text-accent-ink"
      } ${className}`}
    >
      {/* Accent wipes to the foreground; ghost wipes to the accent. Both land on a
          solid field, so the label is never mid-fade over a half-filled box. */}
      <span className={`${WIPE} ${accent ? "bg-fg" : "bg-accent"}`} />
      {children}
      <Arrow external={external} />
    </HubAnchor>
  );
}

/**
 * A quiet destination. Squared rather than the pill it replaced - a row of pills
 * reads as tags to be scanned, and these are doors to be opened.
 */
export function HubChip({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  return (
    <HubAnchor
      href={href}
      external={external}
      className={`${BASE} rounded-brand border border-line px-3 py-1.5 text-xs text-muted hover:border-line-strong hover:text-fg`}
    >
      <span className={`${WIPE} bg-fg/[0.07]`} />
      {children}
      {external ? (
        <span aria-hidden className="text-faint">
          {"↗"}
        </span>
      ) : null}
    </HubAnchor>
  );
}

/**
 * Something to go and look at, carrying WHICH AREA it belongs to.
 *
 * The tones are roster-audit.tsx's, unchanged and on purpose - amber is "check
 * this" and red is "somebody could lose money or control" everywhere else in the
 * portal, and a fresh colour vocabulary here would be a fourth thing to learn.
 *
 * What changed is the shape. As a tinted pill inside a card this was decoration
 * sitting next to the stats; as a squared bar with the tone as a hard left edge it
 * reads as a torn-off docket, and it now sits at the top of the page instead of
 * buried in whichever card happened to own it.
 */
export function HubFlag({
  href,
  external,
  tone,
  scope,
  children,
}: {
  href: string;
  external?: boolean;
  tone: "warn" | "danger";
  scope?: string;
  children: React.ReactNode;
}) {
  const danger = tone === "danger";

  return (
    <HubAnchor
      href={href}
      external={external}
      className={`${BASE} rounded-brand border py-2 pl-0 pr-4 text-left ${
        danger
          ? "border-red-500/25 bg-red-500/[0.07] hover:border-red-500/60"
          : "border-amber-400/25 bg-amber-400/[0.07] hover:border-amber-400/60"
      }`}
    >
      <span
        aria-hidden
        className={`h-full w-1 self-stretch ${danger ? "bg-red-500" : "bg-amber-400"}`}
      />
      <span className="min-w-0 pl-2">
        {scope ? (
          <span className="block text-[10px] font-bold uppercase tracking-kicker text-faint">
            {scope}
          </span>
        ) : null}
        <span
          className={`block text-[13px] font-semibold ${
            danger ? "text-red-300" : "text-amber-300"
          }`}
        >
          {children}
        </span>
      </span>
    </HubAnchor>
  );
}

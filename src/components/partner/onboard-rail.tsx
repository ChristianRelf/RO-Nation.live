import Link from "next/link";
import { ONBOARDING_STEPS, canOpenStep } from "@/lib/partner-onboarding";
import { cn } from "@/lib/utils";

// The progress rail down the side of the guided setup.
//
// A SERVER component, which is unusual for a thing that looks this much like navigation.
// It can be, because the current step comes from the URL and the furthest step comes from
// a row - there is no client state anywhere in it, and making it "use client" would mean
// shipping the step list to the browser and re-deciding on every render what the server
// already knows.
//
// ---- Steps ahead are text, not links --------------------------------------
//
// canOpenStep() is the rule (see the note on it), and it is enforced by the PAGE - this
// only renders it. A step nobody may open yet is drawn as plain text rather than a
// disabled link, because a link that looks clickable and refuses is worse than one that
// never invited the click.
export function OnboardRail({
  current,
  row,
}: {
  /** Index of the step being viewed. */
  current: number;
  row: { step: number; completedAt: Date | null } | null;
}) {
  return (
    <nav aria-label="Setup progress" className="lg:sticky lg:top-24 lg:self-start">
      <p className="text-[11px] font-bold uppercase tracking-kicker text-faint">
        Setting up
      </p>

      <ol className="mt-4 flex gap-1 overflow-x-auto lg:flex-col lg:gap-0 lg:overflow-visible">
        {ONBOARDING_STEPS.map((step, i) => {
          const done = row?.completedAt ? true : i < (row?.step ?? 0);
          const active = i === current;
          const open = canOpenStep(row, i);

          const inner = (
            <span className="flex items-baseline gap-3">
              <span
                aria-hidden
                className={cn(
                  "tnum shrink-0 font-mono text-[11px]",
                  active ? "text-accent" : done ? "text-muted" : "text-faint",
                )}
              >
                {done && !active ? "✓" : String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium leading-tight">
                  {step.title}
                </span>
                {/* Only under the step being read. The rail is a position indicator, and
                    five blurbs stacked in it is a second copy of the page. */}
                {active ? (
                  <span className="mt-1 hidden text-xs text-muted lg:block">
                    {step.blurb}
                  </span>
                ) : null}
              </span>
            </span>
          );

          const className = cn(
            "block shrink-0 rounded-lg px-3 py-2.5 transition-colors",
            active
              ? "bg-surface text-fg"
              : open
                ? "text-muted hover:bg-surface/60 hover:text-fg"
                : "text-faint",
          );

          return (
            <li key={step.slug} className="lg:w-56">
              {open && !active ? (
                <Link href={`/onboard/${step.slug}`} className={className}>
                  {inner}
                </Link>
              ) : (
                <span
                  aria-current={active ? "step" : undefined}
                  className={className}
                >
                  {inner}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

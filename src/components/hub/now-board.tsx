import { dateBlock } from "@/lib/format";
import type { HubAreaLive } from "@/lib/hub-dashboard";
import { CapacityMeter } from "./capacity-meter";
import { HubButton } from "./hub-button";

// The next thing that happens, anywhere you hold a door.
//
// This is the content change the redesign is actually for. Every card used to
// carry its own "next show", which meant the one question the page exists to
// answer - what is closest? - was left to the reader to work out by comparing four
// cards, in a layout that gave the quietest area the same weight as the one with a
// house opening in two hours. One show is nearer than the others. The page should
// say which.
//
// Sorting happens in the page, on NextShow.at; see the note on that field.

export function NowBoard({
  area,
  scopeCount,
}: {
  area: HubAreaLive;
  scopeCount: number;
}) {
  const show = area.nextShow;
  if (!show) return null;

  const { day, month } = dateBlock(show.at);

  return (
    <section className="relative isolate overflow-hidden rounded-brand border border-line-strong">
      {/* The room's own light, borrowed. A restrained top tint, not a bloom. */}
      <div
        aria-hidden
        className="accent-glow pointer-events-none absolute inset-x-0 top-0 -z-10 h-40"
      />

      <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:gap-10">
        {/* Ticket-stub date block - the same lockup the public site stamps on a
            listing, so a show reads the same on both sides of the login. */}
        <div className="flex shrink-0 items-center gap-5">
          <div className="text-center">
            <p className="tnum display text-6xl leading-none text-accent">{day}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-kicker text-faint">
              {month}
            </p>
          </div>
          <div aria-hidden className="h-16 w-px bg-line-strong lg:h-20" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-kicker text-accent">
            {/* Only worth saying "of everything you hold" when there is more than
                one thing held. On a single area it is just the next show. */}
            {scopeCount > 1 ? "Up next · across your areas" : "Up next"}
          </p>

          <h2 className="display mt-2 text-3xl leading-none sm:text-4xl">
            {show.title}
          </h2>

          <p className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted">
            <span className="font-semibold text-fg">{show.relative}</span>
            <span aria-hidden className="text-faint">
              ·
            </span>
            <span>{show.when}</span>
            <span aria-hidden className="text-faint">
              ·
            </span>
            <span className="text-[10px] font-bold uppercase tracking-kicker text-faint">
              {area.name}
            </span>
          </p>

          <div className="mt-5 max-w-sm">
            <CapacityMeter show={show} />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col">
          <HubButton href={show.href} external={show.external} variant="accent">
            Open show
          </HubButton>
          <HubButton href={area.home.href} external={area.home.external}>
            {area.name}
          </HubButton>
        </div>
      </div>
    </section>
  );
}

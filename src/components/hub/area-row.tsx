import type { HubAreaLive } from "@/lib/hub-dashboard";
import { LocalTime } from "@/components/local-time";
import { HubAnchor } from "./hub-anchor";
import { HubChip } from "./hub-button";

// One area, as a row on a call list.
//
// This replaces AreaCard, and the change is not only visual. A grid of equal cards
// makes an equal claim about every area: four boxes of identical weight, each
// carrying a blurb, three stat figures, a capacity bar and two rows of chips. Read
// four of those and you have read most of the portal without deciding anything.
//
// A row is scannable down a single edge. The things that differ between areas -
// the name, whether a show is close, whether anything is wrong - line up in
// columns, so comparing them is a glance down rather than four separate reads. The
// blurb goes (the name already says it), the stats compress to one line, and the
// attention flags are gone from here entirely: they are hoisted to the top of the
// page, where they can be seen without opening anything. See AttentionBoard.
//
// The whole row is one target for the area's home. That is a stretched overlay
// anchor UNDER the content rather than a wrapper around it, because the chips are
// links too and an <a> inside an <a> is invalid - so the content layer is
// pointer-events-none and the chips opt back in.

const KIND_LABEL: Record<HubAreaLive["kind"], string> = {
  partner: "Partner",
  company: "Company",
  shasha: "Roster",
};

export function AreaRow({ area, index }: { area: HubAreaLive; index: number }) {
  return (
    <li className="group relative isolate border-t border-line">
      {/* The wipe. Faint - a whole row lighting up at card strength would strobe
          down a list on the way to the one you want. */}
      <span
        aria-hidden
        className="absolute inset-0 -z-10 origin-left scale-x-0 bg-accent/[0.05] transition-transform duration-300 ease-settle group-hover:scale-x-100"
      />

      <HubAnchor
        href={area.home.href}
        external={area.home.external}
        className="absolute inset-0 z-0"
      >
        <span className="sr-only">Open {area.name}</span>
      </HubAnchor>

      <div className="pointer-events-none relative z-10 flex flex-col gap-4 py-6 lg:flex-row lg:items-center lg:gap-8">
        {/* Position on the list, not an ID. It gives the column a left edge to
            run down, which is the whole reason rows beat boxes here. */}
        <p
          aria-hidden
          className="tnum display shrink-0 text-2xl leading-none text-faint transition-colors duration-200 group-hover:text-accent lg:w-10"
        >
          {String(index + 1).padStart(2, "0")}
        </p>

        <div className="min-w-0 lg:w-56 lg:shrink-0">
          <h3 className="display truncate text-2xl leading-none transition-colors duration-200 group-hover:text-accent">
            {area.name}
          </h3>
          <p className="mt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-kicker">
            <span className={area.canWrite ? "text-accent" : "text-faint"}>
              {area.roleLabel}
            </span>
            <span aria-hidden className="h-2.5 w-px bg-line-strong" />
            <span className="text-faint">{KIND_LABEL[area.kind]}</span>
          </p>
        </div>

        {/* Three states, and they have to read differently - see HubAreaLive.
            hasShows false is ABSENT, not zeroed. */}
        <div className="min-w-0 flex-1">
          {area.hasShows ? (
            area.nextShow ? (
              <>
                <p className="truncate text-sm font-semibold">
                  {area.nextShow.title}
                </p>
                <p className="tnum mt-1 text-xs text-muted">
                  <span className="text-fg">{area.nextShow.relative}</span> ·{" "}
                  <LocalTime value={area.nextShow.at} mode="datetime" />
                </p>
              </>
            ) : (
              <p className="text-sm text-muted">
                No shows scheduled.{" "}
                {/* Only offered to somebody who can actually do it. A link that
                    bounces read-only staff is worse than no link - the same call
                    PortalNav makes about its keys item. */}
                {area.canWrite ? (
                  <HubAnchor
                    href={
                      area.links.find((l) => l.label === "Events")?.href ??
                      `${area.home.href}/studio/events`
                    }
                    external={area.kind === "company"}
                    className="pointer-events-auto font-semibold text-accent transition-opacity hover:opacity-80"
                  >
                    Plan one →
                  </HubAnchor>
                ) : null}
              </p>
            )
          ) : (
            <p className="text-xs text-faint">No line-up here.</p>
          )}
        </div>

        {area.stats.length ? (
          <div className="flex shrink-0 gap-6">
            {area.stats.map((s) => (
              <div key={s.label}>
                <p className="tnum font-display text-xl leading-none">
                  {s.value.toLocaleString()}
                </p>
                <p className="mt-1.5 text-[10px] font-bold uppercase tracking-kicker text-faint">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex shrink-0 items-center gap-2">
          <div className="pointer-events-auto flex flex-wrap gap-2">
            {area.links.map((l) => (
              <HubChip key={l.href + l.label} href={l.href} external={l.external}>
                {l.label}
              </HubChip>
            ))}
          </div>

          <span
            aria-hidden
            className="hidden text-lg text-faint transition-all duration-300 ease-settle group-hover:translate-x-1 group-hover:text-accent lg:block"
          >
            →
          </span>
        </div>
      </div>
    </li>
  );
}

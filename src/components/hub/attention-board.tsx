import type { HubAreaLive } from "@/lib/hub-dashboard";
import { HubFlag } from "./hub-button";

// Everything wrong, across every area, in one place.
//
// These used to be chips near the bottom of whichever card owned them, which meant
// "a key that can sell or void is still live" was findable only by someone already
// reading that area - and the card it sat in looked exactly like the three healthy
// ones next to it. The severity was in the data and not on the page.
//
// Hoisting them costs the context of which area each belongs to, so every flag now
// carries its own scope label. That is the same call the activity feed makes and
// for the same reason: once a list spans areas, a line that does not say whose it
// is has stopped being actionable.
//
// Danger before warn. Within a tone, the order the areas came in - which is
// getHubData()'s order, and is stable.

export function AttentionBoard({ areas }: { areas: HubAreaLive[] }) {
  const flags = areas.flatMap((area) =>
    area.attention.map((item) => ({ ...item, scope: area.name })),
  );

  if (!flags.length) return null;

  const ordered = [
    ...flags.filter((f) => f.tone === "danger"),
    ...flags.filter((f) => f.tone !== "danger"),
  ];

  return (
    <section>
      <div className="flex items-baseline gap-3">
        <h2 className="display text-lg leading-none">Needs you</h2>
        <span aria-hidden className="h-px flex-1 bg-line" />
        <span className="tnum text-[10px] font-bold uppercase tracking-kicker text-faint">
          {ordered.length}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((flag) => (
          <HubFlag
            key={`${flag.scope}:${flag.label}`}
            href={flag.href}
            external={flag.external}
            tone={flag.tone}
            scope={flag.scope}
          >
            {flag.label}
          </HubFlag>
        ))}
      </div>
    </section>
  );
}

import { VENUE_PRESETS } from "@/lib/venue/presets";
import { totalSeats } from "@/lib/venue/seats";
import { VenueMap } from "./venue-map";

// The starter-room picker on the new-venue page.
//
// A grid of radio cards - "Empty room" and the presets from lib/venue/presets.ts - each
// showing the room actually drawn, via the same <VenueMap> the designer and the picker use.
// No JavaScript of its own: native radios named `preset`, read by the create action, which
// resolves the id to a layout SERVER-SIDE. The value posted is only ever an id.
//
// "Empty room" is first and checked, so the default is exactly the old behaviour - a blank
// canvas - and a preset is something you opt into.

export function VenuePresetPicker() {
  return (
    <fieldset>
      <legend className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-faint">
        Start from
      </legend>
      <p className="mb-3 text-xs text-faint">
        Pick a room to start with, then draw the stage in where it goes. The seating is a
        starting point - drag, rename and re-tier anything once you&apos;re in.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Empty room - the default, and the old behaviour. */}
        <label className="group relative block cursor-pointer">
          <input
            type="radio"
            name="preset"
            value=""
            defaultChecked
            className="peer sr-only"
          />
          <div className="h-full rounded-brand border border-line p-3 transition-colors hover:border-line-strong peer-checked:border-accent peer-checked:bg-accent-soft">
            <div className="flex aspect-[10/7] items-center justify-center overflow-hidden rounded-brand border border-dashed border-line bg-bg">
              <span className="text-xs text-faint">Blank canvas</span>
            </div>
            <p className="mt-2 text-sm font-semibold">Empty room</p>
            <p className="mt-0.5 text-xs text-faint">
              Start from nothing and draw the whole room yourself.
            </p>
          </div>
        </label>

        {VENUE_PRESETS.map((preset) => {
          const built = preset.build();
          const seats = totalSeats(built);

          return (
            <label key={preset.id} className="group relative block cursor-pointer">
              <input
                type="radio"
                name="preset"
                value={preset.id}
                className="peer sr-only"
              />
              <div className="h-full rounded-brand border border-line p-3 transition-colors hover:border-line-strong peer-checked:border-accent peer-checked:bg-accent-soft">
                <div className="aspect-[10/7] overflow-hidden rounded-brand border border-line bg-bg">
                  {/* Nothing is focused, so this is the overview: section outlines, no
                      chairs - which is exactly the shape you're choosing between. */}
                  <VenueMap layout={built} className="h-full w-full" />
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">
                    <span className="text-faint">{preset.group}</span> · {preset.name}
                  </p>
                  <span className="shrink-0 font-mono text-[10px] text-faint">
                    ~{seats} seats
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-faint">{preset.blurb}</p>
              </div>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

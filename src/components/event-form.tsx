import type { Event } from "@prisma/client";

// Format a Date for a <input type="datetime-local">. Uses the server's local
// time; set the container TZ env var if you want a specific zone.
function toInput(d?: Date | null) {
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}

const inputClass =
  "w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted";

export function EventForm({
  action,
  event,
  error,
}: {
  action: (formData: FormData) => void;
  event?: Event;
  error?: string;
}) {
  return (
    <form action={action} className="space-y-6">
      {event ? <input type="hidden" name="id" value={event.id} /> : null}

      {error === "required" ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          Title, start date/time and description are required.
        </p>
      ) : null}

      <div className="card space-y-5 p-6">
        <div>
          <label className={labelClass}>Title *</label>
          <input
            name="title"
            required
            defaultValue={event?.title}
            placeholder="MIDNIGHT FREQUENCY"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Tagline</label>
          <input
            name="tagline"
            defaultValue={event?.tagline ?? ""}
            placeholder="A four-stage after-dark concert takeover"
            className={inputClass}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Category</label>
            <input
              name="category"
              list="event-categories"
              defaultValue={event?.category ?? "Live Show"}
              className={inputClass}
            />
            <datalist id="event-categories">
              <option value="Live Show" />
              <option value="Showcase" />
              <option value="Tournament" />
              <option value="Festival" />
              <option value="Meet-up" />
            </datalist>
          </div>
          <div>
            <label className={labelClass}>Venue (in-experience)</label>
            <input
              name="venue"
              defaultValue={event?.venue ?? ""}
              placeholder="The Vault — Main Stage"
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>Description *</label>
          <textarea
            name="description"
            required
            rows={6}
            defaultValue={event?.description}
            placeholder="Set the scene. Line breaks are preserved."
            className={`${inputClass} resize-y`}
          />
        </div>
      </div>

      <div className="card space-y-5 p-6">
        <h3 className="font-display text-lg">Schedule &amp; capacity</h3>
        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Doors open</label>
            <input
              type="datetime-local"
              name="doorsAt"
              defaultValue={toInput(event?.doorsAt)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Starts *</label>
            <input
              type="datetime-local"
              name="startsAt"
              required
              defaultValue={toInput(event?.startsAt)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Ends</label>
            <input
              type="datetime-local"
              name="endsAt"
              defaultValue={toInput(event?.endsAt)}
              className={inputClass}
            />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Capacity (0 = unlimited)</label>
            <input
              type="number"
              name="capacity"
              min={0}
              defaultValue={event?.capacity ?? 0}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Roblox experience URL</label>
            <input
              name="placeUrl"
              defaultValue={event?.placeUrl ?? ""}
              placeholder="https://www.roblox.com/games/..."
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div className="card space-y-5 p-6">
        <h3 className="font-display text-lg">Artwork &amp; visibility</h3>
        <div>
          <label className={labelClass}>Thumbnail image URL</label>
          <input
            name="thumbnailUrl"
            defaultValue={event?.thumbnailUrl ?? ""}
            placeholder="/placeholders/event-01.svg  or  https://…"
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-faint">
            Use a full URL, or drop an image in{" "}
            <code className="font-mono">/public/</code> and reference it like{" "}
            <code className="font-mono">/my-event.jpg</code>. 3:2 ratio looks
            best.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Status</label>
            <select
              name="status"
              defaultValue={event?.status ?? "DRAFT"}
              className={inputClass}
            >
              <option value="DRAFT">Draft (hidden)</option>
              <option value="PUBLISHED">Published (live)</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-line bg-bg px-4 py-2.5">
            <input
              type="checkbox"
              name="featured"
              defaultChecked={event?.featured ?? false}
              className="h-4 w-4 accent-accent"
            />
            <span className="text-sm">Feature on homepage</span>
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn btn-accent">
          {event ? "Save changes" : "Create event"}
        </button>
        <a href="/admin/events" className="btn btn-ghost">
          Cancel
        </a>
      </div>
    </form>
  );
}

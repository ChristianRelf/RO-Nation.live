import type { Event } from "@prisma/client";
import { TierEditor, type TierDraft } from "./tier-editor";
import { UploadField } from "./upload-field";

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
  cancelHref = "/company/events",
  scope,
  tiers = [],
  robuxEnabled = false,
}: {
  action: (formData: FormData) => void;
  event?: Event;
  error?: string;
  /** Where "Cancel" goes — /company and every partner portal share this form. */
  cancelHref?: string;
  /**
   * The partner whose show this is, when the form is used in a partner portal.
   * Omitted by RNL's own tools, whose actions don't read it.
   *
   * Safe to carry in the body: the action does not trust it for authorization —
   * it re-reads the caller's grant on that partner from the database. See
   * app/actions/partner-events.ts.
   */
  scope?: string;
  /** The event's existing tiers. Empty = a single free General Admission. */
  tiers?: TierDraft[];
  /** Whether a priced tier could actually be SOLD by this org today. It can't. */
  robuxEnabled?: boolean;
}) {
  return (
    <form action={action} className="space-y-6">
      {event ? <input type="hidden" name="id" value={event.id} /> : null}
      {scope ? <input type="hidden" name="scope" value={scope} /> : null}

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

      <TierEditor initial={tiers} robuxEnabled={robuxEnabled} />

      <div className="card space-y-5 p-6">
        <h3 className="font-display text-lg">Artwork &amp; visibility</h3>
        {/* `scope` is the partner slug when a partner portal renders this form, and
            undefined in /company — which is exactly what the upload route wants to
            know. It authorises nothing; the route re-checks it. */}
        <UploadField
          name="thumbnailUrl"
          label="Thumbnail image"
          defaultValue={event?.thumbnailUrl}
          partner={scope}
          hint="JPG, PNG, GIF, WebP or SVG, up to 5 MB. A 3:2 ratio looks best. You can also paste a URL."
        />
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
        <a href={cancelHref} className="btn btn-ghost">
          Cancel
        </a>
      </div>
    </form>
  );
}

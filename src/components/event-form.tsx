import type { Event } from "@prisma/client";
import { TierEditor, type TierDraft } from "./tier-editor";
import { UploadField } from "./upload-field";
// Was a private helper in this file. It is in lib/format.ts now, because the survey
// builder needs the identical thing and a second copy of a date formatter is a second
// answer to the same question.
import { toDateTimeInput as toInput } from "@/lib/format";

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
  /** Where "Cancel" goes - /company and every partner portal share this form. */
  cancelHref?: string;
  /**
   * The partner whose show this is, when the form is used in a partner portal.
   * Omitted by RNL's own tools, whose actions don't read it.
   *
   * Safe to carry in the body: the action does not trust it for authorization -
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
              placeholder="The Vault - Main Stage"
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
        <div>
          <label className={labelClass}>Ticket terms</label>
          <textarea
            name="ticketTerms"
            rows={5}
            defaultValue={event?.ticketTerms?.join("\n") ?? ""}
            placeholder="One clause per line. Leave blank to use the standard terms."
            className={`${inputClass} resize-y`}
          />
          {/* Says what blank MEANS, because an empty box that silently substitutes
              five clauses is otherwise indistinguishable from an empty box that
              means "no terms at all". */}
          <p className="mt-1.5 text-xs text-faint">
            One clause per line, shown at checkout. Leave blank for the standard
            terms. Whatever is here when somebody reserves is frozen onto their
            ticket - editing this later never changes a ticket already issued.
          </p>
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
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Place ID</label>
            <input
              name="placeId"
              inputMode="numeric"
              defaultValue={event?.placeId ?? ""}
              placeholder="1234567890"
              className={inputClass}
            />
            {/* Two columns, not one URL parsed at use time. The URL above is what a human
                clicks; this is what a deep link is BUILT from, and scraping the id back
                out of a pasted link works right up until one arrives with a tracking
                query string on the end. See the note on Event.placeId. */}
            <p className="mt-1 text-xs text-faint">
              The number in the experience URL. Used to deep-link a buyer straight into the
              show.
            </p>
          </div>
          <div>
            <label className={labelClass}>Seating</label>
            <select
              name="seatMode"
              defaultValue={event?.seatMode ?? "NONE"}
              className={inputClass}
            >
              <option value="NONE">General admission (no map)</option>
              <option value="SECTION">Pick a section</option>
              <option value="SEAT">Pick a seat</option>
            </select>
            {/* The map is drawn on the event's own Venue page, and drawing it is NOT what
                puts seats on sale - this select is. Leave it on NONE and the picker is
                skipped outright, which is exactly what keeps every existing show
                untouched. */}
            <p className="mt-1 text-xs text-faint">
              Anything but general admission needs a venue drawn on this show&apos;s Venue
              page — and nobody is offered a seat until this is set.
            </p>
          </div>
        </div>
      </div>

      {/* `scope` decides which verify action the editor calls, and `eventId` lets it ignore
          THIS event's own tiers when it checks whether a game pass is already spoken for -
          a tier that has already saved its pass is not colliding with itself. Neither is
          authority: the action re-proves the caller's grant on the scope they name. */}
      <TierEditor
        initial={tiers}
        robuxEnabled={robuxEnabled}
        eventId={event?.id ?? ""}
        scope={scope ?? ""}
      />

      <div className="card space-y-5 p-6">
        <h3 className="font-display text-lg">Artwork &amp; visibility</h3>
        {/* `scope` is the partner slug when a partner portal renders this form, and
            undefined in /company - which is exactly what the upload route wants to
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

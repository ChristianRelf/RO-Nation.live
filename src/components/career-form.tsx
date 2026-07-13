import type { Career } from "@prisma/client";

const inputClass =
  "w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted";

export function CareerForm({
  action,
  career,
  error,
  cancelHref = "/company/careers",
  scope,
}: {
  action: (formData: FormData) => void;
  career?: Career;
  error?: string;
  /** Where "Cancel" goes — /company and every partner studio share this form. */
  cancelHref?: string;
  /**
   * The partner whose role this is, when a partner's studio renders the form.
   * Omitted by /company. Authorises nothing — the action re-reads the grant.
   */
  scope?: string;
}) {
  return (
    <form action={action} className="space-y-6">
      {career ? <input type="hidden" name="id" value={career.id} /> : null}
      {scope ? <input type="hidden" name="scope" value={scope} /> : null}

      {error === "required" ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          Title, summary and description are required.
        </p>
      ) : null}

      <div className="card space-y-5 p-6">
        <div>
          <label className={labelClass}>Role title *</label>
          <input
            name="title"
            required
            defaultValue={career?.title}
            placeholder="Event Host"
            className={inputClass}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Department</label>
            <input
              name="department"
              list="departments"
              defaultValue={career?.department ?? "Events"}
              className={inputClass}
            />
            <datalist id="departments">
              <option value="Live Operations" />
              <option value="Production" />
              <option value="Marketing" />
              <option value="Trust & Safety" />
              <option value="Events" />
            </datalist>
          </div>
          <div>
            <label className={labelClass}>Commitment</label>
            <input
              name="commitment"
              list="commitments"
              defaultValue={career?.commitment ?? "Volunteer"}
              className={inputClass}
            />
            <datalist id="commitments">
              <option value="Volunteer" />
              <option value="Paid" />
              <option value="Trial → Paid" />
            </datalist>
          </div>
          <div>
            <label className={labelClass}>Location</label>
            <input
              name="location"
              defaultValue={career?.location ?? "Remote — Roblox"}
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>One-line summary *</label>
          <input
            name="summary"
            required
            defaultValue={career?.summary}
            placeholder="Be the voice of the show — run the crowd and keep the energy up."
            className={inputClass}
          />
        </div>
      </div>

      <div className="card space-y-5 p-6">
        <div>
          <label className={labelClass}>Full description *</label>
          <textarea
            name="description"
            required
            rows={6}
            defaultValue={career?.description}
            className={`${inputClass} resize-y`}
          />
        </div>
        <div>
          <label className={labelClass}>Requirements (one per line)</label>
          <textarea
            name="requirements"
            rows={6}
            defaultValue={career?.requirements}
            placeholder={"Comfortable on voice\nAvailable 2+ events/month\n14+ and active"}
            className={`${inputClass} resize-y`}
          />
        </div>
        <div className="max-w-xs">
          <label className={labelClass}>Status</label>
          <select
            name="status"
            defaultValue={career?.status ?? "DRAFT"}
            className={inputClass}
          >
            <option value="DRAFT">Draft (hidden)</option>
            <option value="OPEN">Open (accepting)</option>
            <option value="CLOSED">Closed (visible, no apply)</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn btn-accent">
          {career ? "Save changes" : "Create role"}
        </button>
        <a href={cancelHref} className="btn btn-ghost">
          Cancel
        </a>
      </div>
    </form>
  );
}

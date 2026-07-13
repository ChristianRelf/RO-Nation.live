import type { Guide } from "@prisma/client";
import { MarkdownField } from "./markdown-field";
import { BODY_MAX } from "@/lib/content";

const inputClass =
  "w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted";

/**
 * A sibling of PostForm rather than a reuse of it: that one is typed `post?: Post`
 * and every line of its copy is about the blog. The shared part — the markdown
 * editor and its body cap — is the component both of them compose.
 */
export function GuideForm({
  action,
  guide,
  sections,
  error,
  cancelHref = "/company/docs/guides",
}: {
  action: (formData: FormData) => void;
  guide?: Guide;
  /** Sections already in use, offered as a datalist so they don't fragment. */
  sections: string[];
  error?: string;
  cancelHref?: string;
}) {
  return (
    <form action={action} className="space-y-6">
      {guide ? <input type="hidden" name="id" value={guide.id} /> : null}

      {error === "required" ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          A title and body are required.
        </p>
      ) : null}

      <div className="card space-y-5 p-6">
        <div>
          <label className={labelClass}>Title *</label>
          <input
            name="title"
            required
            defaultValue={guide?.title}
            placeholder="Working the door on show night"
            className={inputClass}
          />
          {guide ? (
            <p className="mt-1.5 text-xs text-faint">
              URL: <code className="font-mono">/docs/guides/{guide.slug}</code> —
              this stays put if you retitle, so links already shared keep working.
            </p>
          ) : null}
        </div>

        <div>
          <label className={labelClass}>Excerpt</label>
          <input
            name="excerpt"
            defaultValue={guide?.excerpt ?? ""}
            placeholder="One line shown on the guides index."
            className={inputClass}
          />
        </div>

        <MarkdownField
          name="body"
          label="Body"
          required
          defaultValue={guide?.body}
          maxLength={BODY_MAX}
          hint="Markdown. Blank line between paragraphs; ## for a heading, **bold**, [link](url), - for a list."
        />
      </div>

      <div className="card space-y-5 p-6">
        <h3 className="font-display text-lg">Filing &amp; visibility</h3>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Section</label>
            <input
              name="section"
              list="guide-sections"
              defaultValue={guide?.section ?? "General"}
              placeholder="Running a show"
              className={inputClass}
            />
            {/* Existing sections, so "Running a show" and "Running A Show" don't
                both end up as headings on the index. */}
            <datalist id="guide-sections">
              {sections.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div>
            <label className={labelClass}>Order</label>
            <input
              name="order"
              type="number"
              defaultValue={guide?.order ?? 0}
              className={inputClass}
            />
            <p className="mt-1.5 text-xs text-faint">
              Low first, within the section. Ties fall back to the title.
            </p>
          </div>
        </div>

        <div>
          <label className={labelClass}>Status</label>
          <select
            name="status"
            defaultValue={guide?.status ?? "DRAFT"}
            className={inputClass}
          >
            <option value="DRAFT">Draft (hidden)</option>
            <option value="PUBLISHED">Published (staff &amp; partner crew)</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <p className="mt-1.5 text-xs text-faint">
            Published guides are visible to anybody with a portal door — including
            read-only staff. They are not public.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn btn-accent">
          {guide ? "Save changes" : "Create guide"}
        </button>
        <a href={cancelHref} className="btn btn-ghost">
          Cancel
        </a>
      </div>
    </form>
  );
}

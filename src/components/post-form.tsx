import type { Post } from "@prisma/client";
import { UploadField } from "./upload-field";
import { MarkdownField } from "./markdown-field";
import { BODY_MAX } from "@/lib/content";

const inputClass =
  "w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted";

export function PostForm({
  action,
  post,
  error,
  cancelHref = "/company/blog",
  scope,
}: {
  action: (formData: FormData) => void;
  post?: Post;
  error?: string;
  cancelHref?: string;
  /**
   * The partner whose post this is, when a partner's studio renders this form.
   * Omitted by /company, whose actions don't read it.
   *
   * Safe to carry in the body: the action does not trust it for authorization —
   * it re-reads the caller's grant on that partner. Same contract as EventForm.
   */
  scope?: string;
}) {
  return (
    <form action={action} className="space-y-6">
      {post ? <input type="hidden" name="id" value={post.id} /> : null}
      {scope ? <input type="hidden" name="scope" value={scope} /> : null}

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
            defaultValue={post?.title}
            placeholder="Behind the build: Midnight Frequency"
            className={inputClass}
          />
          {post ? (
            <p className="mt-1.5 text-xs text-faint">
              URL: <code className="font-mono">/blog/{post.slug}</code> — this
              stays put if you retitle, so shared links keep working.
            </p>
          ) : null}
        </div>

        <div>
          <label className={labelClass}>Excerpt</label>
          <input
            name="excerpt"
            defaultValue={post?.excerpt ?? ""}
            placeholder="One line shown on the blog listing."
            className={inputClass}
          />
        </div>

        <MarkdownField
          name="body"
          label="Body"
          required
          defaultValue={post?.body}
          maxLength={BODY_MAX}
          hint="Markdown. Blank line between paragraphs; ## for a heading, **bold**, [link](url), - for a list."
        />
      </div>

      <div className="card space-y-5 p-6">
        <h3 className="font-display text-lg">Artwork &amp; visibility</h3>

        <UploadField
          name="coverUrl"
          label="Cover image"
          defaultValue={post?.coverUrl}
          partner={scope}
          hint="JPG, PNG, GIF, WebP or SVG, up to 5 MB. You can also paste a URL."
        />

        <div>
          <label className={labelClass}>Status</label>
          <select
            name="status"
            defaultValue={post?.status ?? "DRAFT"}
            className={inputClass}
          >
            <option value="DRAFT">Draft (hidden)</option>
            <option value="PUBLISHED">Published (live)</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn btn-accent">
          {post ? "Save changes" : "Create post"}
        </button>
        <a href={cancelHref} className="btn btn-ghost">
          Cancel
        </a>
      </div>
    </form>
  );
}

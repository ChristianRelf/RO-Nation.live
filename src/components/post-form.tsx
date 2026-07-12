import type { Post } from "@prisma/client";

const inputClass =
  "w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted";

export function PostForm({
  action,
  post,
  error,
  cancelHref = "/studio/blog",
}: {
  action: (formData: FormData) => void;
  post?: Post;
  error?: string;
  cancelHref?: string;
}) {
  return (
    <form action={action} className="space-y-6">
      {post ? <input type="hidden" name="id" value={post.id} /> : null}

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

        <div>
          <label className={labelClass}>Body *</label>
          <textarea
            name="body"
            required
            rows={16}
            defaultValue={post?.body}
            placeholder={"Write the post here.\n\nBlank lines start a new paragraph."}
            className={`${inputClass} resize-y leading-relaxed`}
          />
          <p className="mt-1.5 text-xs text-faint">
            Plain text. Leave a blank line between paragraphs.
          </p>
        </div>
      </div>

      <div className="card space-y-5 p-6">
        <h3 className="font-display text-lg">Artwork &amp; visibility</h3>

        <div>
          <label className={labelClass}>Cover image URL</label>
          <input
            name="coverUrl"
            defaultValue={post?.coverUrl ?? ""}
            placeholder="/placeholders/event-01.svg  or  https://…"
            className={inputClass}
          />
        </div>

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

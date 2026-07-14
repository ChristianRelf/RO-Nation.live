"use client";

import { useRef, useState } from "react";

// An image field: pick a file, it uploads, and the resulting URL lands in the
// form as `name`.
//
// The value posted with the form is still a plain string in a plain input -
// exactly what thumbnailUrl/coverUrl already were - so nothing downstream
// changes: the server actions, lib/content.ts and the database all keep seeing a
// URL. The file goes up out-of-band to /api/uploads, before the form is
// submitted, and only the URL it returns rides along with the submit.
//
// That is also why this is not a `<input type="file">` inside the form: a server
// action's body caps at 1 MB, so a 5 MB image posted through one fails on the way
// in. See the note in app/api/uploads/route.ts.
//
// Pasting a URL by hand still works - the text input is right there, and remote
// URLs (or a file in /public) are perfectly valid values.

export function UploadField({
  name,
  label,
  defaultValue,
  partner,
  hint,
}: {
  /** The form field the URL is written into - "thumbnailUrl", "coverUrl". */
  name: string;
  label: string;
  defaultValue?: string | null;
  /**
   * The partner whose folder this uploads into. Omitted for RNL's own.
   *
   * It authorises NOTHING: the route re-reads who you are and re-checks that you
   * may write to this partner. Sending someone else's slug from the console gets
   * you a 403, not their folder.
   */
  partner?: string;
  hint?: string;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);

    try {
      const body = new FormData();
      body.append("file", file);
      if (partner) body.append("partner", partner);

      const res = await fetch("/api/uploads", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };

      if (!res.ok || !data.url) {
        setError(data.error ?? "That didn't upload. Try again.");
        return;
      }
      setUrl(data.url);
    } catch {
      setError("That didn't upload - check your connection and try again.");
    } finally {
      setBusy(false);
      // Let the same file be picked again after a failure. Without this, choosing
      // the identical file fires no change event and the field looks dead.
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-fg">{label}</label>

      <div className="flex flex-wrap items-start gap-4">
        {url ? (
          // Not next/image: the source is a user-supplied string that may be a
          // remote host nobody has added to next.config's remotePatterns, and an
          // unconfigured host there throws rather than degrading. A preview in a
          // form is not worth a crash.
          //
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            className="h-20 w-32 rounded-brand border border-line object-cover"
          />
        ) : (
          <div className="grid h-20 w-32 place-items-center rounded-brand border border-dashed border-line text-xs text-faint">
            No image
          </div>
        )}

        <div className="min-w-[15rem] flex-1">
          <input
            type="text"
            name={name}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/uploads/…  or  https://…"
            className="w-full rounded-brand border border-line bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="btn btn-ghost !py-1.5 !px-3 text-xs disabled:opacity-50"
            >
              {busy ? "Uploading…" : "Upload image"}
            </button>
            {url ? (
              <button
                type="button"
                onClick={() => setUrl("")}
                className="text-xs text-faint transition-colors hover:text-red-400"
              >
                Remove
              </button>
            ) : null}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />

          {error ? (
            <p className="mt-2 text-xs text-red-400">{error}</p>
          ) : hint ? (
            <p className="mt-2 text-xs text-faint">{hint}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";

// The clothing-template field. A sibling of UploadField, and deliberately NOT it.
//
// UploadField posts to /api/uploads, which writes to the volume Caddy serves, and puts
// the resulting public URL in a text input the admin can read, copy and paste. Every
// one of those properties is wrong for a shirt template: the file IS the product, so a
// public URL is a free copy of it, and a pasteable URL field is an invitation to point
// this at one.
//
// So this field:
//
//   • posts to /api/uploads/texture, which writes to the PRIVATE volume;
//   • carries a storage path, not a URL, in a HIDDEN input - there is nothing to paste
//     a URL into, because a template must not have one;
//   • previews through the staff-only, watermarked, no-store route, so even the admin
//     page never holds a clean copy of the flat.
//
// The preview is the one crack in the door and it is a deliberate one: staff have to be
// able to see WHICH shirt is on file, or the field will eventually hold last season's
// artwork with nothing to say so. See api/merch/texture-preview for why it is safe to
// crack it that far and no further.

export function TextureField({
  name,
  label,
  defaultValue,
  hint,
}: {
  /** The form field the storage path is written into - "texturePath". */
  name: string;
  label: string;
  defaultValue?: string | null;
  hint?: string;
}) {
  const [path, setPath] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);

    try {
      const body = new FormData();
      body.append("file", file);

      const res = await fetch("/api/uploads/texture", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as {
        path?: string;
        error?: string;
      };

      if (!res.ok || !data.path) {
        setError(data.error ?? "That didn't upload. Try again.");
        return;
      }
      setPath(data.path);
    } catch {
      setError("That didn't upload - check your connection and try again.");
    } finally {
      setBusy(false);
      // Let the same file be picked again after a failure. Without this, choosing the
      // identical file fires no change event and the field looks dead.
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-fg">{label}</label>

      <div className="flex flex-wrap items-start gap-4">
        {path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/merch/texture-preview?path=${encodeURIComponent(path)}`}
            alt="The template currently on file, watermarked"
            className="h-24 w-24 rounded-brand border border-line bg-bg object-contain"
          />
        ) : (
          <div className="grid h-24 w-24 place-items-center rounded-brand border border-dashed border-line text-center text-xs text-faint">
            No template
          </div>
        )}

        <div className="min-w-[15rem] flex-1">
          {/* Hidden, and hidden on purpose: a template has no URL, so there is nothing
              here for anyone to type. The only way to change this value is to upload a
              file or to clear it. */}
          <input type="hidden" name={name} value={path} />

          <p className="text-sm text-fg">
            {path ? "Template on file - stored privately." : "No template on file."}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="btn btn-ghost !py-1.5 !px-3 text-xs disabled:opacity-50"
            >
              {busy ? "Uploading…" : path ? "Replace template" : "Upload template"}
            </button>
            {path ? (
              <button
                type="button"
                onClick={() => setPath("")}
                className="text-xs text-faint transition-colors hover:text-red-400"
              >
                Remove
              </button>
            ) : null}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/png"
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

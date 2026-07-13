"use client";

import { useRef, useState } from "react";
import { formatBytes } from "@/lib/format";

/**
 * The file picker for a brand asset.
 *
 * Not UploadField: that one is for pictures — it previews an image, it posts to
 * /api/uploads, and what it writes into the form is a URL. A brand asset may be a
 * 20 MB PDF that has no URL at all (an INTERNAL one is never served from a path),
 * so what this writes into the form is the four facts the action needs to file it:
 * where it was stored, what it was called, what it is, and how big.
 *
 * All four are re-checked server-side — see createBrandAsset in actions/docs.ts.
 * They are in the form because the file was uploaded before the form was
 * submitted, not because they are trusted.
 */
export function AssetFileField({
  visibility,
}: {
  /** Selects which disk the route writes to. Posted with the file, not with the form. */
  visibility: "PUBLIC" | "INTERNAL";
}) {
  const [file, setFile] = useState<{
    storagePath: string;
    filename: string;
    mime: string;
    size: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(picked: File) {
    setBusy(true);
    setError(null);

    try {
      const body = new FormData();
      body.append("file", picked);
      body.append("visibility", visibility);

      const res = await fetch("/api/uploads/brand", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as {
        storagePath?: string;
        filename?: string;
        mime?: string;
        size?: number;
        error?: string;
      };

      if (!res.ok || !data.storagePath) {
        setError(data.error ?? "That didn't upload. Try again.");
        return;
      }

      setFile({
        storagePath: data.storagePath,
        filename: data.filename ?? picked.name,
        mime: data.mime ?? "",
        size: data.size ?? 0,
      });
    } catch {
      setError("That didn't upload — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
        File *
      </label>

      {file ? (
        <input type="hidden" name="storagePath" value={file.storagePath} />
      ) : null}
      {file ? <input type="hidden" name="filename" value={file.filename} /> : null}
      {file ? <input type="hidden" name="mime" value={file.mime} /> : null}
      {file ? <input type="hidden" name="size" value={file.size} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="btn btn-ghost !px-3 !py-1.5 text-xs disabled:opacity-50"
        >
          {busy ? "Uploading…" : file ? "Replace file" : "Choose file"}
        </button>

        {file ? (
          <p className="text-xs text-muted">
            <span className="font-medium text-fg">{file.filename}</span>{" "}
            <span className="text-faint">
              · {file.mime} · {formatBytes(file.size)}
            </span>
          </p>
        ) : null}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,application/pdf"
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (picked) void upload(picked);
        }}
      />

      {error ? (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      ) : (
        <p className="mt-2 text-xs text-faint">
          JPG, PNG, GIF, WebP or SVG up to 5 MB; PDF up to 25 MB.
        </p>
      )}
    </div>
  );
}

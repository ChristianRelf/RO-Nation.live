"use client";

import { useRef, useState } from "react";
import {
  acceptAttr,
  describeTypes,
  formatBytes,
} from "@/lib/survey-files";

// The answer field for a FILE_UPLOAD question.
//
// Same shape as components/upload-field.tsx and for the same reason: the files go
// up out-of-band as they are picked, and what actually rides along with the form
// submit is a handful of ids in hidden inputs. A server action's request body caps
// at 1 MB, so a real <input type="file"> inside this form would fail on anything
// worth attaching.
//
// The ids are posted under the SAME name the other question types use (`q_<id>`),
// once per file, so readAnswer() in actions/survey.ts reads them with the getAll()
// it already uses for checkboxes.
//
// Everything here is a courtesy. The count, the size and the type are all enforced
// again by api/uploads/survey and again at submit; checking them in the browser
// only means a respondent finds out before waiting for an upload rather than after.

type Attached = { id: string; filename: string; size: number };

export function SurveyFileField({
  name,
  questionId,
  maxFiles,
  maxFileMb,
  fileTypes,
  required,
  defaultFiles,
}: {
  /** `q_<questionId>` - the field the ids are posted under. */
  name: string;
  questionId: string;
  maxFiles: number;
  maxFileMb: number;
  /** Allowed mimes. Empty means every type the door accepts. */
  fileTypes: string[];
  required: boolean;
  /**
   * Files already uploaded against this question and not yet submitted.
   *
   * Starting empty instead would put the field permanently out of step with the
   * server after a refresh - it counts these rows towards the limit whether or not
   * the browser remembers them. See the note in survey/[code]/page.tsx.
   */
  defaultFiles: Attached[];
}) {
  const [files, setFiles] = useState<Attached[]>(defaultFiles);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const full = files.length + busy >= maxFiles;

  async function upload(picked: File[]) {
    setError(null);

    // Trimmed to what is left rather than refused outright - picking five files
    // for a three-file question should attach three, not nothing.
    const room = maxFiles - files.length - busy;
    const take = picked.slice(0, Math.max(0, room));
    if (picked.length > take.length) {
      setError(
        `Only ${maxFiles} file${maxFiles === 1 ? "" : "s"} can be attached here.`,
      );
    }

    for (const file of take) {
      if (file.size > maxFileMb * 1024 * 1024) {
        setError(`"${file.name}" is over ${maxFileMb} MB.`);
        continue;
      }

      setBusy((n) => n + 1);
      try {
        const body = new FormData();
        body.append("file", file);
        body.append("questionId", questionId);

        const res = await fetch("/api/uploads/survey", {
          method: "POST",
          body,
        });
        const data = (await res.json().catch(() => ({}))) as Partial<Attached> & {
          error?: string;
        };

        const id = data.id;
        if (!res.ok || !id) {
          setError(data.error ?? "That didn't upload. Try again.");
          continue;
        }
        setFiles((prev) => [
          ...prev,
          {
            id,
            filename: data.filename ?? file.name,
            size: data.size ?? file.size,
          },
        ]);
      } catch {
        setError("That didn't upload - check your connection and try again.");
      } finally {
        setBusy((n) => n - 1);
      }
    }

    // Let the same file be picked again after a failure. Without this, choosing
    // the identical file fires no change event and the field looks dead.
    if (inputRef.current) inputRef.current.value = "";
  }

  async function remove(id: string) {
    // Dropped from the form first so the button always feels instant; the request
    // behind it only frees the slot server-side, and a failed one leaves an orphan
    // that the cull sweeps rather than anything the respondent has to care about.
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setError(null);
    await fetch(`/api/uploads/survey?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }).catch(() => {});
  }

  return (
    <div>
      {/* What the form actually posts. One per file, all under `name`. */}
      {files.map((f) => (
        <input key={f.id} type="hidden" name={name} value={f.id} />
      ))}

      {files.length ? (
        <ul className="mb-3 space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-bg px-4 py-3 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">{f.filename}</span>
              <span className="tnum shrink-0 text-xs text-faint">
                {formatBytes(f.size)}
              </span>
              <button
                type="button"
                onClick={() => void remove(f.id)}
                className="shrink-0 text-xs text-faint transition-colors hover:text-red-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy > 0 || full}
        className="btn btn-ghost w-full disabled:opacity-50"
      >
        {busy > 0
          ? "Uploading…"
          : full
            ? `${maxFiles} file${maxFiles === 1 ? "" : "s"} attached`
            : files.length
              ? "Add another file"
              : "Choose file"}
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple={maxFiles > 1}
        accept={acceptAttr(fileTypes)}
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          if (picked.length) void upload(picked);
        }}
      />

      {error ? (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      ) : (
        <p className="mt-2 text-xs text-faint">
          {describeTypes(fileTypes)} · up to {maxFileMb} MB each ·{" "}
          {maxFiles === 1 ? "one file" : `up to ${maxFiles} files`}
          {required && !files.length ? " · required" : ""}
        </p>
      )}
    </div>
  );
}

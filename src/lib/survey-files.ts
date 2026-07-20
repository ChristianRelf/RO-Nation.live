// What a survey may ask people to attach, and the limits an author can put on it.
//
// Deliberately NOT server-only: the builder is a client component and has to draw
// the same list the upload door enforces. One module so the two cannot drift - a
// checkbox offering something api/uploads/survey would reject is a survey that
// silently loses answers.

/**
 * The types a FILE_UPLOAD question can accept, and what to call them.
 *
 * This list is short because it is exactly what lib/uploads.ts can VERIFY. Every
 * entry is recognised from its magic bytes, so the type recorded against a file is
 * what the file actually is - not what the browser claimed or what the extension
 * said. Adding a row here without teaching sniff() to recognise it would mean
 * accepting a type on the uploader's word, which is the one thing that module is
 * built not to do.
 *
 * SVG is absent on purpose - see SURVEY_FILE_TYPES in lib/uploads.ts.
 */
export const SURVEY_FILE_CHOICES = [
  { mime: "image/jpeg", label: "JPG", hint: "Photos" },
  { mime: "image/png", label: "PNG", hint: "Screenshots" },
  { mime: "image/gif", label: "GIF", hint: "Animations" },
  { mime: "image/webp", label: "WebP", hint: "Photos" },
  { mime: "application/pdf", label: "PDF", hint: "Documents" },
] as const;

/** The mimes alone, in the order above. */
export const SURVEY_FILE_MIMES: readonly string[] = SURVEY_FILE_CHOICES.map(
  (c) => c.mime,
);

/** How many files one question may take. One is the sane default. */
export const MAX_FILES_LIMIT = 10;
export const DEFAULT_MAX_FILES = 1;

/**
 * The per-file sizes an author can pick, in MB.
 *
 * The ceiling matches MAX_UPLOAD_BYTES, but picking 25 does not mean every type
 * gets 25 MB: lib/uploads.ts keeps its own per-type cap (5 MB for an image, 25 for
 * a PDF) and takes whichever is smaller. So this narrows, it never widens, and the
 * builder says so rather than letting somebody promise their respondents a 25 MB
 * PNG that the door will refuse.
 */
export const FILE_SIZE_CHOICES = [1, 2, 5, 10, 25] as const;
export const DEFAULT_MAX_FILE_MB = 5;

/** The `accept` attribute for a file picker offering `mimes`. */
export const acceptAttr = (mimes: readonly string[]) =>
  (mimes.length ? mimes : SURVEY_FILE_MIMES).join(",");

/** "JPG, PNG or PDF" - for hints and error messages. */
export function describeTypes(mimes: readonly string[]) {
  const list = (mimes.length ? mimes : SURVEY_FILE_MIMES)
    .map((m) => SURVEY_FILE_CHOICES.find((c) => c.mime === m)?.label ?? m)
    .filter(Boolean);
  if (list.length <= 1) return list[0] ?? "";
  return `${list.slice(0, -1).join(", ")} or ${list[list.length - 1]}`;
}

/** "2 MB" / "700 KB" - one place, so every surface rounds the same way. */
export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / 1024 / 1024;
    return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

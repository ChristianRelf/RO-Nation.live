"use client";

import { useState } from "react";
import type { QuestionType, Survey, SurveyQuestion } from "@prisma/client";
import { toDateTimeInput } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  DEFAULT_MAX_FILES,
  DEFAULT_MAX_FILE_MB,
  FILE_SIZE_CHOICES,
  MAX_FILES_LIMIT,
  SURVEY_FILE_CHOICES,
} from "@/lib/survey-files";

const inputClass =
  "w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted";

type Draft = {
  key: string;
  type: QuestionType;
  prompt: string;
  helpText: string;
  required: boolean;
  options: string[];
  /** FILE_UPLOAD only - see the file settings block below. */
  maxFiles: number;
  maxFileMb: number;
  fileTypes: string[];
};

const TYPES: { value: QuestionType; label: string; hint: string }[] = [
  { value: "SHORT_TEXT", label: "Short text", hint: "One-line answer" },
  { value: "LONG_TEXT", label: "Long text", hint: "Paragraph answer" },
  { value: "CHOICE", label: "Multiple choice", hint: "Pick one option" },
  { value: "CHECKBOXES", label: "Checkboxes", hint: "Pick any number" },
  { value: "RATING", label: "Rating", hint: "1 to 5" },
  { value: "YES_NO", label: "Yes / No", hint: "Two options" },
  { value: "FILE_UPLOAD", label: "File upload", hint: "Attach files" },
];

const hasOptions = (t: QuestionType) => t === "CHOICE" || t === "CHECKBOXES";
const hasFiles = (t: QuestionType) => t === "FILE_UPLOAD";

let seq = 0;
const newKey = () => `q${seq++}`;

function blank(): Draft {
  return {
    key: newKey(),
    type: "SHORT_TEXT",
    prompt: "",
    helpText: "",
    required: false,
    options: [],
    maxFiles: DEFAULT_MAX_FILES,
    maxFileMb: DEFAULT_MAX_FILE_MB,
    // Empty means every type the door accepts - the same convention the column
    // uses, so a question nobody configured behaves like one that ticked them all.
    fileTypes: [],
  };
}

export function SurveyBuilder({
  action,
  survey,
  questions,
  error,
  locked,
}: {
  action: (formData: FormData) => void;
  survey?: Survey;
  questions?: SurveyQuestion[];
  error?: string;
  /** Someone has already answered - questions are frozen. */
  locked?: boolean;
}) {
  const [items, setItems] = useState<Draft[]>(() =>
    questions?.length
      ? questions.map((q) => ({
          key: newKey(),
          type: q.type,
          prompt: q.prompt,
          helpText: q.helpText ?? "",
          required: q.required,
          options: q.options,
          maxFiles: q.maxFiles ?? DEFAULT_MAX_FILES,
          maxFileMb: q.maxFileMb ?? DEFAULT_MAX_FILE_MB,
          fileTypes: q.fileTypes,
        }))
      : [blank()],
  );

  function patch(key: string, next: Partial<Draft>) {
    setItems((prev) =>
      prev.map((q) => (q.key === key ? { ...q, ...next } : q)),
    );
  }

  function move(index: number, by: number) {
    setItems((prev) => {
      const to = index + by;
      if (to < 0 || to >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[to]] = [copy[to], copy[index]];
      return copy;
    });
  }

  // The server re-validates all of this; it's serialised as JSON because the
  // shape (options nested per question) doesn't fit flat form fields.
  const payload = JSON.stringify(
    items.map((q) => ({
      type: q.type,
      prompt: q.prompt.trim(),
      helpText: q.helpText.trim() || null,
      required: q.required,
      options: hasOptions(q.type)
        ? q.options.map((o) => o.trim()).filter(Boolean)
        : [],
      // Nulled off the other types for the same reason options are emptied: a
      // question switched from File upload to Short text should not keep a stale
      // size cap in the column, waiting to confuse whoever reads the row next.
      maxFiles: hasFiles(q.type) ? q.maxFiles : null,
      maxFileMb: hasFiles(q.type) ? q.maxFileMb : null,
      fileTypes: hasFiles(q.type) ? q.fileTypes : [],
    })),
  );

  const problems = items.filter(
    (q) =>
      !q.prompt.trim() ||
      (hasOptions(q.type) &&
        q.options.map((o) => o.trim()).filter(Boolean).length < 2),
  );

  return (
    <form action={action} className="space-y-6">
      {survey ? <input type="hidden" name="id" value={survey.id} /> : null}
      <input type="hidden" name="questions" value={payload} />

      {error === "required" ? (
        <Alert>A title is required.</Alert>
      ) : error === "questions" ? (
        <Alert>
          Every question needs a prompt, and choice questions need at least two
          options.
        </Alert>
      ) : null}

      {locked ? (
        <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-200">
          People have already answered this survey, so the questions are locked -
          changing them now would break the results. You can still edit the
          title, description and status.
        </p>
      ) : null}

      <div className="card space-y-5 p-6">
        <div>
          <label className={labelClass}>Title *</label>
          <input
            name="title"
            required
            defaultValue={survey?.title}
            placeholder="Midnight Frequency - how did we do?"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Intro</label>
          <textarea
            name="description"
            rows={3}
            defaultValue={survey?.description ?? ""}
            placeholder="Shown above the questions. Tell people why you're asking."
            className={`${inputClass} resize-y`}
          />
        </div>

        <div>
          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-bg px-4 py-3",
            )}
          >
            <input
              type="checkbox"
              name="multipleResponses"
              defaultChecked={survey?.multipleResponses ?? false}
              className="mt-0.5 h-4 w-4 accent-accent"
            />
            <span className="text-sm">
              <span className="font-semibold">Allow multiple responses</span>
              <span className="mt-1 block text-xs text-faint">
                Off, each Roblox account can answer once - the usual choice for a
                poll or a post-event survey. On, the same person can submit as
                often as they like, which suits a suggestion box or a recurring
                check-in. People still sign in either way.
              </span>
            </span>
          </label>
        </div>

        <div>
          <label className={labelClass}>Status</label>
          <select
            name="status"
            defaultValue={survey?.status ?? "DRAFT"}
            className={inputClass}
          >
            <option value="DRAFT">Draft - nobody can open it</option>
            <option value="OPEN">Open - accepting responses</option>
            <option value="CLOSED">Closed - link says it&apos;s finished</option>
          </select>
        </div>

        {/* Survey.closesAt was ENFORCED and UNSETTABLE: actions/survey.ts refuses a
            response after it, and survey/[code] renders the page as closed - but this
            builder never posted the field and readSurveyForm never read it, so the column
            could only ever be null. Half a feature: the lock shipped, the key did not.

            Left empty, the survey stays open until somebody closes it by hand, which is
            exactly how it behaved before. */}
        <div>
          <label className={labelClass}>Closes</label>
          <input
            type="datetime-local"
            name="closesAt"
            defaultValue={toDateTimeInput(survey?.closesAt)}
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-faint">
            Optional. After this it answers as closed, whatever the status says. Clear
            it to leave it open indefinitely. Uses the server&apos;s timezone, like an
            event&apos;s start time.
          </p>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {items.map((q, i) => (
          <div key={q.key} className="card p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="font-mono text-sm text-accent">
                {String(i + 1).padStart(2, "0")}
              </span>

              {!locked ? (
                <div className="flex items-center gap-1">
                  <IconBtn
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    label="Move up"
                  >
                    ↑
                  </IconBtn>
                  <IconBtn
                    onClick={() => move(i, 1)}
                    disabled={i === items.length - 1}
                    label="Move down"
                  >
                    ↓
                  </IconBtn>
                  <IconBtn
                    onClick={() =>
                      setItems((prev) =>
                        prev.length > 1
                          ? prev.filter((x) => x.key !== q.key)
                          : prev,
                      )
                    }
                    disabled={items.length === 1}
                    label="Remove question"
                    danger
                  >
                    ×
                  </IconBtn>
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div>
                <label className={labelClass}>Question *</label>
                <input
                  value={q.prompt}
                  disabled={locked}
                  onChange={(e) => patch(q.key, { prompt: e.target.value })}
                  placeholder="How was the sound on the night?"
                  className={cn(inputClass, locked && "opacity-60")}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Type</label>
                  <select
                    value={q.type}
                    disabled={locked}
                    onChange={(e) =>
                      patch(q.key, {
                        type: e.target.value as QuestionType,
                        options: hasOptions(e.target.value as QuestionType)
                          ? q.options.length
                            ? q.options
                            : ["", ""]
                          : [],
                      })
                    }
                    className={cn(inputClass, locked && "opacity-60")}
                  >
                    {TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label} - {t.hint}
                      </option>
                    ))}
                  </select>
                </div>

                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 self-end rounded-xl border border-line bg-bg px-4 py-2.5",
                    locked && "opacity-60",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={q.required}
                    disabled={locked}
                    onChange={(e) => patch(q.key, { required: e.target.checked })}
                    className="h-4 w-4 accent-accent"
                  />
                  <span className="text-sm">Required</span>
                </label>
              </div>

              <div>
                <label className={labelClass}>Help text</label>
                <input
                  value={q.helpText}
                  disabled={locked}
                  onChange={(e) => patch(q.key, { helpText: e.target.value })}
                  placeholder="Optional hint shown under the question."
                  className={cn(inputClass, locked && "opacity-60")}
                />
              </div>

              {hasOptions(q.type) ? (
                <div>
                  <label className={labelClass}>Options (at least 2)</label>
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input
                          value={opt}
                          disabled={locked}
                          onChange={(e) => {
                            const options = [...q.options];
                            options[oi] = e.target.value;
                            patch(q.key, { options });
                          }}
                          placeholder={`Option ${oi + 1}`}
                          className={cn(inputClass, locked && "opacity-60")}
                        />
                        {!locked ? (
                          <IconBtn
                            onClick={() =>
                              patch(q.key, {
                                options: q.options.filter((_, x) => x !== oi),
                              })
                            }
                            disabled={q.options.length <= 2}
                            label="Remove option"
                            danger
                          >
                            ×
                          </IconBtn>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {!locked ? (
                    <button
                      type="button"
                      onClick={() =>
                        patch(q.key, { options: [...q.options, ""] })
                      }
                      className="mt-2 text-xs font-semibold uppercase tracking-kicker text-muted hover:text-fg"
                    >
                      + Add option
                    </button>
                  ) : null}
                </div>
              ) : null}

              {hasFiles(q.type) ? (
                <div className="space-y-4 border-t border-line pt-4">
                  <p className={labelClass}>What people may attach</p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>How many files</label>
                      <select
                        value={q.maxFiles}
                        disabled={locked}
                        onChange={(e) =>
                          patch(q.key, { maxFiles: Number(e.target.value) })
                        }
                        className={cn(inputClass, locked && "opacity-60")}
                      >
                        {Array.from({ length: MAX_FILES_LIMIT }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i === 0 ? "1 file" : `Up to ${i + 1} files`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>Max size per file</label>
                      <select
                        value={q.maxFileMb}
                        disabled={locked}
                        onChange={(e) =>
                          patch(q.key, { maxFileMb: Number(e.target.value) })
                        }
                        className={cn(inputClass, locked && "opacity-60")}
                      >
                        {FILE_SIZE_CHOICES.map((mb) => (
                          <option key={mb} value={mb}>
                            {mb} MB
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>
                      File types (none ticked = all of them)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {SURVEY_FILE_CHOICES.map((c) => {
                        const on = q.fileTypes.includes(c.mime);
                        return (
                          <label
                            key={c.mime}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
                              on
                                ? "border-accent bg-accent-soft text-accent"
                                : "border-line bg-bg hover:border-line-strong",
                              locked && "cursor-not-allowed opacity-60",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={locked}
                              onChange={() =>
                                patch(q.key, {
                                  fileTypes: on
                                    ? q.fileTypes.filter((t) => t !== c.mime)
                                    : [...q.fileTypes, c.mime],
                                })
                              }
                              className="h-4 w-4 accent-accent"
                            />
                            <span className="font-semibold">{c.label}</span>
                            <span className="text-xs text-faint">{c.hint}</span>
                          </label>
                        );
                      })}
                    </div>
                    {/* The honest version of the size cap. lib/uploads.ts keeps a
                        5 MB ceiling on images whatever is chosen above, so a 25 MB
                        setting on a photo question would be a promise the upload
                        door refuses to keep - better said here than discovered by a
                        respondent whose file bounces. */}
                    <p className="mt-2 text-xs text-faint">
                      Images are capped at 5 MB however high you set the size -
                      only PDFs use the full 25 MB. Files are private: only
                      Studio users can open them from the results page.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {!locked ? (
        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, blank()])}
          className="btn btn-ghost w-full"
        >
          + Add question
        </button>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          className={cn(
            "btn btn-accent",
            Boolean(problems.length) &&
              !locked &&
              "pointer-events-none opacity-40",
          )}
          disabled={Boolean(problems.length) && !locked}
        >
          {survey ? "Save survey" : "Create survey"}
        </button>
        <a href="/company/surveys" className="btn btn-ghost">
          Cancel
        </a>
        {problems.length > 0 && !locked ? (
          <span className="text-xs text-faint">
            {problems.length} question{problems.length > 1 ? "s" : ""} still
            need work
          </span>
        ) : null}
      </div>
    </form>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
      {children}
    </p>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-lg border border-line text-sm transition-colors",
        disabled
          ? "cursor-not-allowed text-faint opacity-40"
          : danger
            ? "text-muted hover:border-red-500/40 hover:text-red-400"
            : "text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

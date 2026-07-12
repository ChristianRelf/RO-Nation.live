"use client";

import { useState } from "react";
import type { QuestionType, Survey, SurveyQuestion } from "@prisma/client";
import { cn } from "@/lib/utils";

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
};

const TYPES: { value: QuestionType; label: string; hint: string }[] = [
  { value: "SHORT_TEXT", label: "Short text", hint: "One-line answer" },
  { value: "LONG_TEXT", label: "Long text", hint: "Paragraph answer" },
  { value: "CHOICE", label: "Multiple choice", hint: "Pick one option" },
  { value: "CHECKBOXES", label: "Checkboxes", hint: "Pick any number" },
  { value: "RATING", label: "Rating", hint: "1 to 5" },
  { value: "YES_NO", label: "Yes / No", hint: "Two options" },
];

const hasOptions = (t: QuestionType) => t === "CHOICE" || t === "CHECKBOXES";

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
  /** Someone has already answered — questions are frozen. */
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
          People have already answered this survey, so the questions are locked —
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
            placeholder="Midnight Frequency — how did we do?"
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
          <label className={labelClass}>Status</label>
          <select
            name="status"
            defaultValue={survey?.status ?? "DRAFT"}
            className={inputClass}
          >
            <option value="DRAFT">Draft — nobody can open it</option>
            <option value="OPEN">Open — accepting responses</option>
            <option value="CLOSED">Closed — link says it&apos;s finished</option>
          </select>
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
                        {t.label} — {t.hint}
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
        <a href="/studio/surveys" className="btn btn-ghost">
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

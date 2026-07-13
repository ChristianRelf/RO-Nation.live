"use client";

import { useState } from "react";
import { Prose } from "./prose";
import { cn } from "@/lib/utils";

// A Markdown textarea with a preview.
//
// The preview is not a nicety. Markdown is a language where a missing blank line
// silently changes the output, and the only way a writer finds that out otherwise
// is by publishing and looking at the live site. It renders through the SAME
// <Prose> the post itself uses — the same parser, the same styles — so what the
// preview shows is what the page will show, rather than an approximation that is
// right until it isn't.
//
// The value is held in React state and mirrored into the textarea, which is what
// lets the preview update as you type. The textarea keeps its `name`, so the
// server action still just reads formData.get("body") and knows nothing about any
// of this.

const TABS = ["write", "preview"] as const;
type Tab = (typeof TABS)[number];

export function MarkdownField({
  name,
  label,
  defaultValue = "",
  required,
  rows = 18,
  maxLength,
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  rows?: number;
  maxLength?: number;
  hint?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [tab, setTab] = useState<Tab>("write");

  const near = maxLength ? value.length > maxLength * 0.9 : false;

  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between gap-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
          {label}
          {required ? " *" : ""}
        </label>

        <div className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              type="button" // NOT submit. Inside a <form>, a bare button posts it.
              onClick={() => setTab(t)}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold uppercase tracking-wide transition-colors",
                tab === t ? "text-accent" : "text-faint hover:text-muted",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* The textarea is never unmounted — only hidden. Unmounting it would drop
          it from the form, and a submit from the preview tab would post an empty
          body. It would also lose the cursor position and the undo history every
          time somebody peeked at the preview. */}
      <div className={tab === "write" ? "block" : "hidden"}>
        <textarea
          name={name}
          required={required}
          rows={rows}
          maxLength={maxLength}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={"Write the post here.\n\nBlank lines start a new paragraph.\n\n## A heading\n\n**Bold**, *italic*, [a link](https://ronation.live), and:\n\n- a list\n- of things"}
          className="w-full resize-y rounded-xl border border-line bg-bg px-4 py-2.5 font-mono text-sm leading-relaxed outline-none transition-colors focus:border-accent"
        />
      </div>

      {tab === "preview" ? (
        <div className="min-h-[16rem] rounded-xl border border-line bg-bg px-5 py-4">
          {value.trim() ? (
            <Prose content={value} />
          ) : (
            <p className="text-sm text-faint">Nothing to preview yet.</p>
          )}
        </div>
      ) : null}

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-faint">
        <p>{hint}</p>
        {maxLength ? (
          <p className={cn("tnum", near && "text-amber-400")}>
            {value.length.toLocaleString()} / {maxLength.toLocaleString()}
          </p>
        ) : null}
      </div>
    </div>
  );
}

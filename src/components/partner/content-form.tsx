"use client";

import { useState } from "react";
import type { FaqItem, PartnerHomeContent } from "@/lib/partners/content";
import { UploadField } from "@/components/upload-field";

// The partner's homepage, as a form.
//
// The FAQ is the only awkward part: it is a list of pairs of arbitrary length,
// which flat form fields model badly. So it is edited in React and posted as ONE
// hidden JSON field — the same trick the survey builder uses for its questions,
// and the server re-validates it with zod either way (lib/partners/content.ts).

const inputClass =
  "w-full rounded-brand border border-line bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted";

export function PartnerContentForm({
  action,
  content,
  slug,
  cancelHref,
  error,
  saved,
}: {
  action: (formData: FormData) => void;
  content: PartnerHomeContent;
  slug: string;
  cancelHref: string;
  error?: string;
  saved?: boolean;
}) {
  const [faq, setFaq] = useState<FaqItem[]>(content.faq);

  const update = (i: number, patch: Partial<FaqItem>) =>
    setFaq((prev) => prev.map((f, n) => (n === i ? { ...f, ...patch } : f)));

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="scope" value={slug} />
      {/* Empty rows are dropped here rather than server-side, so a half-typed
          question that someone abandoned doesn't fail the whole save. */}
      <input
        type="hidden"
        name="faq"
        value={JSON.stringify(
          faq.filter((f) => f.q.trim() && f.a.trim()),
        )}
      />

      {saved ? (
        <p className="rounded-brand border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm text-accent">
          Saved. Your homepage is updated.
        </p>
      ) : null}
      {error === "faq" ? (
        <p className="rounded-brand border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          The FAQ couldn&apos;t be saved. Check every question has an answer.
        </p>
      ) : null}

      {/* ---- Hero ---------------------------------------------------- */}
      <div className="card space-y-5 p-6">
        <div>
          <h3 className="font-display text-lg">Hero</h3>
          <p className="mt-1 text-xs text-faint">
            The first thing anybody sees. Leave a field empty to use the default.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Kicker</label>
            <input
              name="heroKicker"
              defaultValue={content.heroKicker}
              placeholder="Roblox tribute shows"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Headline</label>
            <input
              name="heroTitle"
              defaultValue={content.heroTitle ?? ""}
              placeholder="Leave empty for the big wordmark"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Subtitle</label>
          <textarea
            name="heroSubtitle"
            rows={3}
            defaultValue={content.heroSubtitle}
            className={`${inputClass} resize-y leading-relaxed`}
          />
        </div>

        <UploadField
          name="heroImageUrl"
          label="Hero image"
          defaultValue={content.heroImageUrl}
          partner={slug}
          hint="Optional. Sits behind the hero. Dark, wide images work best."
        />
      </div>

      {/* ---- About --------------------------------------------------- */}
      <div className="card space-y-5 p-6">
        <div>
          <h3 className="font-display text-lg">About panel</h3>
          <p className="mt-1 text-xs text-faint">
            The light panel further down the page. Leave the body empty to hide
            the whole panel.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Kicker</label>
            <input
              name="aboutKicker"
              defaultValue={content.aboutKicker}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Heading</label>
            <input
              name="aboutTitle"
              defaultValue={content.aboutTitle ?? ""}
              placeholder="A fan project, staged properly."
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Body</label>
          <textarea
            name="aboutBody"
            rows={5}
            defaultValue={content.aboutBody ?? ""}
            className={`${inputClass} resize-y leading-relaxed`}
          />
        </div>

        <div>
          <label className={labelClass}>Small print</label>
          <textarea
            name="aboutNote"
            rows={3}
            defaultValue={content.aboutNote ?? ""}
            className={`${inputClass} resize-y leading-relaxed`}
          />
          <p className="mt-1.5 text-xs text-faint">
            The quieter line under the body. This is <em>not</em> your legal
            disclaimer — that one is set by RNL and always shows in your footer.
          </p>
        </div>
      </div>

      {/* ---- FAQ ----------------------------------------------------- */}
      <div className="card space-y-4 p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h3 className="font-display text-lg">FAQ</h3>
            <p className="mt-1 text-xs text-faint">
              The accordion at the bottom of your homepage. Up to 20.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFaq((f) => [...f, { q: "", a: "" }])}
            disabled={faq.length >= 20}
            className="btn btn-ghost !py-1.5 !px-3 text-xs disabled:opacity-40"
          >
            + Add question
          </button>
        </div>

        {faq.length ? (
          <div className="space-y-3">
            {faq.map((item, i) => (
              <div key={i} className="rounded-brand border border-line p-4">
                <div className="flex items-start gap-3">
                  <span className="tnum mt-2.5 text-xs text-faint">{i + 1}</span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      value={item.q}
                      onChange={(e) => update(i, { q: e.target.value })}
                      placeholder="What does a ticket cost?"
                      className={inputClass}
                    />
                    <textarea
                      value={item.a}
                      onChange={(e) => update(i, { a: e.target.value })}
                      rows={2}
                      placeholder="Nothing. Every ticket is free."
                      className={`${inputClass} resize-y leading-relaxed`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFaq((prev) => prev.filter((_, n) => n !== i))
                    }
                    aria-label="Remove question"
                    className="mt-2 text-sm text-faint transition-colors hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-brand border border-dashed border-line px-4 py-8 text-center text-sm text-faint">
            No questions yet. Without any, the section is left off your homepage.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button className="btn btn-accent">Save homepage</button>
        <a href={cancelHref} className="btn btn-ghost">
          Cancel
        </a>
      </div>
    </form>
  );
}

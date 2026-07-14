"use client";

import { useState } from "react";
import { AssetFileField } from "./asset-file-field";

const inputClass =
  "w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted";

/**
 * The new-asset form.
 *
 * Client-side, because `visibility` has to be known BEFORE the file is uploaded:
 * it decides which disk the upload route writes to, so the radio has to be able
 * to tell AssetFileField what it currently is. (This is also why it cannot be
 * changed afterwards - see updateBrandAsset in actions/docs.ts.)
 */
export function BrandAssetForm({
  action,
  categories,
  error,
}: {
  action: (formData: FormData) => void;
  categories: string[];
  error?: string;
}) {
  const [visibility, setVisibility] = useState<"PUBLIC" | "INTERNAL">("PUBLIC");

  return (
    <form action={action} className="card space-y-5 p-6">
      <h3 className="font-display text-lg">Add an asset</h3>

      {error === "required" ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          A title and a file are required.
        </p>
      ) : error === "file" ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          That file didn&apos;t make it to disk. Choose it again.
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Title *</label>
          <input
            name="title"
            required
            placeholder="Primary logo (dark)"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Category</label>
          <input
            name="category"
            list="asset-categories"
            defaultValue="Logos"
            placeholder="Logos"
            className={inputClass}
          />
          <datalist id="asset-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>

      <div>
        <label className={labelClass}>Description</label>
        <input
          name="description"
          placeholder="Use on dark backgrounds. Don't recolour it."
          className={inputClass}
        />
      </div>

      <fieldset>
        <legend className={labelClass}>Visibility *</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              {
                value: "PUBLIC",
                title: "Public",
                body: "Anyone with the link can open it, signed out. Right for logos and press art - a shareable URL is the point.",
              },
              {
                value: "INTERNAL",
                title: "Internal",
                body: "Only staff and partner crew. Stored where nothing can serve it without checking a session. Right for guideline PDFs and unreleased art.",
              },
            ] as const
          ).map((o) => (
            <label
              key={o.value}
              className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                visibility === o.value
                  ? "border-accent bg-surface"
                  : "border-line hover:border-fg/20"
              }`}
            >
              <input
                type="radio"
                name="visibility"
                value={o.value}
                checked={visibility === o.value}
                onChange={() => setVisibility(o.value)}
                className="sr-only"
              />
              <span className="block text-sm font-semibold">{o.title}</span>
              <span className="mt-1 block text-xs text-muted">{o.body}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-faint">
          This can&apos;t be changed later - it decides where the file is stored.
          To change it, re-upload the file.
        </p>
      </fieldset>

      {/* Keyed on visibility so switching it clears any file already uploaded
          under the other one - that file is on the wrong disk now. */}
      <AssetFileField key={visibility} visibility={visibility} />

      <div>
        <label className={labelClass}>Order</label>
        <input
          name="order"
          type="number"
          defaultValue={0}
          className={`${inputClass} sm:max-w-[10rem]`}
        />
      </div>

      <button className="btn btn-accent">Add asset</button>
    </form>
  );
}

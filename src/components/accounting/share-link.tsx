"use client";

import { useState } from "react";

/**
 * The share link, with a copy button.
 *
 * A client island on the otherwise server-rendered document page, and the only reason
 * it exists: the clipboard is a browser API. It shows the URL in full rather than
 * hiding it behind the button, because this link is a BEARER capability - anyone holding
 * it reads the document - and a person about to paste one into a DM should be able to
 * see exactly what they are handing over.
 */
export function ShareLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Share link"
        className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-700"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            // Back to "Copy" after a beat, so the button is honest the next time it is
            // looked at rather than claiming a copy that happened a minute ago.
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard denied (insecure origin, or the user said no). The input above
            // is right there and selectable, so there is nothing to recover from -
            // saying "copied" when nothing was copied would be the actual failure.
            setCopied(false);
          }
        }}
        className="shrink-0 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-80"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

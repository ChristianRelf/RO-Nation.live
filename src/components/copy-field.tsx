"use client";

import { useState } from "react";

/**
 * A bearer link, shown in full, with a copy button.
 *
 * A sibling of accounting/share-link.tsx rather than a reuse of it, and the difference is
 * palette, not behaviour: that one lives on a document page, which is a printable sheet in
 * a light theme (neutral-300, neutral-900), and this one lives on the dark company desk.
 * Sharing the component would mean one of the two rendering a white input on a black page.
 *
 * ---- Why the URL is visible rather than hidden behind the button -----------
 *
 * Everything this renders is a BEARER CAPABILITY - an invite code that mints a partner
 * account, a brief token that opens somebody's unreleased artwork. A person about to paste
 * one into a Discord channel should be able to see exactly what they are handing over, and
 * a "Copy link" button with nothing next to it conceals precisely the thing worth reading.
 *
 * It is also, deliberately, NOT an anchor. On this desk a clickable invite link is one
 * click away from a staff member claiming an invitation with their own Roblox account.
 */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        aria-label={label}
        className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 font-mono text-xs text-muted"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            // Back to "Copy" after a beat, so the button is honest the next time somebody
            // looks at it rather than claiming a copy that happened a minute ago.
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard denied - an insecure origin, or the browser said no. The input is
            // right there and selectable, so there is nothing to recover from; saying
            // "Copied" when nothing was would be the actual failure.
            setCopied(false);
          }
        }}
        className="shrink-0 rounded-lg border border-line px-3 py-2 text-[10px] font-bold uppercase tracking-kicker text-muted transition-colors hover:border-accent hover:text-accent"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

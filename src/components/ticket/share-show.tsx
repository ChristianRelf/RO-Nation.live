"use client";

import { useState } from "react";

// "I'm going to this." The site had no way to say it.
//
// The only share affordance anywhere was a static Discord link on the event page,
// and the ticket - the one screen somebody opens BECAUSE they are excited - had
// nothing at all.
//
// ---- What gets shared, and what does not ---------------------------------
//
// THE SHOW'S URL. Never the ticket's.
//
// A ticket page is addressed by an opaque id precisely so the code stays out of
// the address bar (app/tickets/[id]/page.tsx), and a shared link would put that id
// into somebody else's chat window. The link is useless to them anyway - the page
// 404s for anyone who is not the holder - so sharing it is all risk and no point.
// The show is the thing worth sending.
//
// Web Share where it exists (every phone, which is where this gets used), clipboard
// everywhere else. No third state: a button that says "sharing isn't supported" is
// worse than one that quietly copies a link.

export function ShareShow({
  url,
  title,
  className = "btn btn-ghost",
}: {
  /** The SHOW's absolute URL. See above - never the ticket's. */
  url: string;
  title: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const text = `I'm going to ${title}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // Cancelled, or the sheet refused. Both mean "no", and neither is an error
        // worth showing - fall through to copying, which is a reasonable second
        // answer to the same button press.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard permission and no share sheet. Nothing useful left to try,
      // and nothing worth interrupting them over.
    }
  };

  return (
    <button type="button" onClick={share} className={className}>
      {copied ? "Link copied" : "Share this show"}
    </button>
  );
}

"use client";

import { useEffect, useState } from "react";

// Embed a PDF without depending on framing headers.
//
// The obvious way - <iframe src="/files/x.pdf"> - is at the mercy of whatever
// X-Frame-Options / CSP frame-ancestors the file's response happens to carry, and the
// site-wide default is DENY (anti-clickjacking). Relaxing that per-path at the proxy is
// fiddly and easy to get subtly wrong, and when it is wrong the browser just says
// "refused to connect" in a grey box.
//
// So instead: FETCH the bytes (a same-origin fetch is never subject to frame headers,
// and carries the session cookie, so a gated /files/<id> works too), wrap them in a
// `blob:` URL, and frame THAT. A blob URL is in-memory and has no HTTP headers, so
// nothing can refuse to frame it - and the browser still renders it in its own PDF
// viewer, with scroll, zoom, search and print. If the fetch fails, we fall back to a
// plain open link rather than a broken frame.

export function PdfEmbed({ href, title }: { href: string; title: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;

    setState("loading");
    setBlobUrl(null);

    (async () => {
      try {
        const res = await fetch(href, { credentials: "same-origin" });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        if (cancelled) return;
        created = URL.createObjectURL(blob);
        setBlobUrl(created);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
      // Free the bytes when the component unmounts or href changes - a 25 MB blob left
      // dangling per open PDF adds up.
      if (created) URL.revokeObjectURL(created);
    };
  }, [href]);

  if (state === "error") {
    return (
      <div className="grid place-items-center gap-3 bg-bg px-6 py-16 text-center">
        <p className="text-sm text-muted">Couldn&rsquo;t load a preview here.</p>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="btn btn-ghost text-sm"
        >
          Open the PDF
        </a>
      </div>
    );
  }

  return (
    <div className="relative h-[75vh] max-h-[900px] min-h-[420px] w-full bg-bg">
      {state === "loading" ? (
        <div className="absolute inset-0 grid place-items-center text-sm text-faint">
          Loading preview…
        </div>
      ) : null}
      {blobUrl ? (
        <iframe
          src={`${blobUrl}#view=FitH`}
          title={title}
          className="h-full w-full border-0 bg-white"
        />
      ) : null}
    </div>
  );
}

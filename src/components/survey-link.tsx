"use client";

import { useEffect, useState } from "react";

/**
 * The shareable URL for a survey.
 *
 * Built on the client from the current host so it's right in every environment:
 * ronation.live → https://survey.ronation.live/CODE, while on localhost the code
 * is served from the same origin (middleware rewrites it) so you can test the
 * link without setting up subdomains.
 */
export function SurveyLink({ code }: { code: string }) {
  const [url, setUrl] = useState(`/${code}`);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const { protocol, host } = window.location;
    const bare = host.replace(/^www\./, "");
    const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(bare);

    setUrl(
      isLocal
        ? `${protocol}//${host}/${code}`
        : `https://survey.${bare.replace(/^survey\./, "")}/${code}`,
    );
  }, [code]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure origin, denied permission) - the link is
      // right there to copy by hand.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="break-all font-mono text-xs text-accent hover:text-fg"
      >
        {url.replace(/^https?:\/\//, "")}
      </a>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-lg border border-line px-2 py-0.5 text-[10px] font-bold uppercase tracking-kicker text-muted transition-colors hover:text-fg"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

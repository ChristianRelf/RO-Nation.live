"use client";

import Link from "next/link";
import { useEffect } from "react";

// A route-segment error boundary. It still renders INSIDE the root layout, so
// data-brand is already on <html> and every themed class below resolves to the
// right palette - a partner's error page comes out in the partner's brand, on the
// partner's domain, rather than in RNL's blue. See app/layout.tsx.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only handle that ties this to a server log line in
    // production; log the whole error so a dev sees it in the console too.
    console.error(error);
  }, [error]);

  return (
    <div className="shell flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">
        Something broke
      </span>
      <h1 className="display mt-5 text-5xl sm:text-6xl">That didn&apos;t load.</h1>
      <p className="mt-5 max-w-md text-muted">
        Something went wrong on our end - not yours. Give it another go, and if it
        keeps happening the Discord is the fastest way to reach us.
      </p>
      {error.digest ? (
        <p className="mt-4 font-mono text-xs text-faint">ref {error.digest}</p>
      ) : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="btn btn-accent">
          Try again
        </button>
        <Link href="/" className="btn btn-ghost">
          Back home
        </Link>
      </div>
    </div>
  );
}

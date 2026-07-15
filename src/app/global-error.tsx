"use client";

import { useEffect } from "react";

// The last resort. This fires only when the ROOT layout itself throws, which means
// it replaces that layout entirely - no fonts, no brand stylesheet, no header or
// footer to lean on. So it renders its own <html>/<body> and uses inline styles
// only: it cannot assume a single class from globals.css is loaded. Deliberately
// minimal, dark to match the default theme, and brand-agnostic by necessity.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
          background: "#0a0a0a",
          color: "#ece9e1",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}>
          Something went wrong
        </h1>
        <p style={{ maxWidth: "28rem", color: "#8a8880", margin: 0 }}>
          The site hit an unexpected error. Please try again in a moment.
        </p>
        {error.digest ? (
          <p
            style={{
              fontFamily: "monospace",
              fontSize: "0.75rem",
              color: "#5a5852",
              margin: 0,
            }}
          >
            ref {error.digest}
          </p>
        ) : null}
        <button
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            background: "#2b6bff",
            color: "#ffffff",
            border: 0,
            padding: "0.7rem 1.4rem",
            fontWeight: 700,
            cursor: "pointer",
            borderRadius: 3,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { refreshLinkCode, unlinkDiscord } from "@/app/actions/discord-link";

type Linked = {
  discordId: string;
  discordUsername: string | null;
  linkedAt: number;
} | null;

// The rotating link code, and the account's current Discord link.
//
// The code lives server-side (one per account); this only DISPLAYS the current one,
// counts it down, and asks for a fresh one when it lapses. It never invents a code -
// a code the server has not stored could never be redeemed - so every code shown here
// came back from refreshLinkCode().

export function LinkCodePanel({
  initialCode,
  initialExpiresAt,
  ttlSeconds,
  linked: initialLinked,
}: {
  initialCode: string;
  initialExpiresAt: number;
  ttlSeconds: number;
  linked: Linked;
}) {
  const [code, setCode] = useState(initialCode);
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  const [now, setNow] = useState(() => Date.now());
  const [stale, setStale] = useState(false); // session gone - refresh the page
  const [copied, setCopied] = useState(false);
  const [linked, setLinked] = useState<Linked>(initialLinked);
  const [unlinking, startUnlink] = useTransition();

  // A single rotation in flight at a time, so an expiry and a manual click can't
  // both fire and race two codes back.
  const rotating = useRef(false);

  const rotate = useCallback(async () => {
    if (rotating.current) return;
    rotating.current = true;
    try {
      const next = await refreshLinkCode();
      if (!next) {
        setStale(true);
        return;
      }
      setCode(next.code);
      setExpiresAt(next.expiresAt);
      setNow(Date.now());
      setCopied(false);
    } finally {
      rotating.current = false;
    }
  }, []);

  // One 500ms tick drives both the countdown and the auto-rotate.
  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (!stale && t >= expiresAt) void rotate();
    }, 500);
    return () => clearInterval(id);
  }, [expiresAt, stale, rotate]);

  const msLeft = Math.max(0, expiresAt - now);
  const secsLeft = Math.ceil(msLeft / 1000);
  const fraction = Math.max(0, Math.min(1, msLeft / (ttlSeconds * 1000)));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked - the code is right there to read */
    }
  };

  const unlink = () =>
    startUnlink(async () => {
      await unlinkDiscord();
      setLinked(null);
    });

  return (
    <div className="space-y-6">
      {linked ? (
        <div className="card flex flex-wrap items-center justify-between gap-4 border-emerald-400/30 bg-emerald-400/[0.04] p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
              <CheckIcon />
            </span>
            <div>
              <p className="text-sm font-semibold text-emerald-200">
                Discord linked
              </p>
              <p className="text-xs text-muted">
                {linked.discordUsername
                  ? `@${linked.discordUsername}`
                  : `ID ${linked.discordId}`}
              </p>
            </div>
          </div>
          <button
            onClick={unlink}
            disabled={unlinking}
            className="btn btn-ghost text-sm disabled:opacity-50"
          >
            {unlinking ? "Unlinking…" : "Unlink"}
          </button>
        </div>
      ) : null}

      <div className="card p-6 text-center sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
          {linked ? "Link another account" : "Your link code"}
        </p>

        {stale ? (
          <div className="mt-6">
            <p className="text-muted">
              Your session expired.{" "}
              <button
                onClick={() => window.location.reload()}
                className="text-accent underline underline-offset-4 hover:text-fg"
              >
                Refresh the page
              </button>{" "}
              to get a new code.
            </p>
          </div>
        ) : (
          <>
            <div
              className="mt-5 font-mono text-5xl font-bold tabular-nums tracking-[0.15em] text-fg sm:text-6xl"
              aria-label={`Link code ${code.split("").join(" ")}`}
            >
              {code.slice(0, 3)}
              <span className="mx-2 text-faint sm:mx-3">·</span>
              {code.slice(3)}
            </div>

            {/* Time left in this code's life. */}
            <div className="mx-auto mt-6 h-1 w-full max-w-xs overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500 ease-linear"
                style={{ width: `${fraction * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-faint">
              {secsLeft > 0
                ? `Rotates in ${secsLeft}s`
                : "Getting a new code…"}
            </p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button onClick={copy} className="btn btn-ghost gap-1.5 text-sm">
                <CopyIcon />
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={() => void rotate()}
                className="btn btn-ghost text-sm"
              >
                New code
              </button>
            </div>
          </>
        )}
      </div>

      <ol className="space-y-3 text-sm text-muted">
        <Step n={1}>
          Open our Discord and run the bot&rsquo;s link command (for example{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-fg">
            /link
          </code>
          ).
        </Step>
        <Step n={2}>
          Enter the six digits above. The bot ties your Roblox account to your Discord
          and confirms.
        </Step>
        <Step n={3}>
          The code rotates every couple of minutes and is single-use - don&rsquo;t
          share it, and it&rsquo;s fine if it changes before you finish.
        </Step>
      </ol>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line text-xs font-semibold text-fg">
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m20 6-11 11-5-5" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

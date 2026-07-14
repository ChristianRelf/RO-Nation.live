"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { MerchKind } from "@prisma/client";
import { InkSweep } from "./ink-sweep";
import { Stamp } from "./furniture";
import { cn } from "@/lib/utils";

// The table the garment is laid on.
//
// three.js touches `window` at import time, so the viewer can never be server-
// rendered - and `ssr: false` also keeps ~600KB of WebGL out of the bundle of every
// page that has no character to show. That option is only legal inside a client
// component, which is the entire reason this wrapper exists.
//
// Note what it does NOT do: it never reaches the dynamic import at all unless there is
// a texture. A product with no template - which is most of them - costs zero bytes of
// three.js.
const AvatarViewer = dynamic(() => import("./avatar-viewer"), {
  ssr: false,
  loading: () => (
    <div className="grid aspect-square place-items-center">
      <p className="font-mono text-[10px] uppercase tracking-kicker text-faint">
        Loading
      </p>
    </div>
  ),
});

type View = "front" | "back" | "flat";

export function ProductStage({
  kind,
  textureUrl,
  thumbnailUrl,
  name,
}: {
  kind: MerchKind;
  textureUrl: string | null;
  thumbnailUrl: string | null;
  name: string;
}) {
  const [view, setView] = useState<View>("front");
  const has3D = Boolean(textureUrl);

  const tabs: { id: View; label: string }[] = [
    { id: "front", label: "Front" },
    { id: "back", label: "Back" },
    { id: "flat", label: "Flat print" },
  ];

  return (
    <div>
      {/* The plinth. A bordered, guilloched panel with printer's crop marks - never a
          filled card, because sleeptokenro.css sets .card { background: transparent }
          and anything that leaned on a fill would come apart on that shelf. */}
      <InkSweep className="crop-marks relative rounded-brand border border-line bg-surface/40">
        <div className="ticket-guilloche pointer-events-none absolute inset-0" aria-hidden />

        <div className="relative p-4 sm:p-6">
          {has3D && view !== "flat" ? (
            <AvatarViewer
              kind={kind}
              textureUrl={textureUrl as string}
              name={name}
              view={view}
              paused={false}
            />
          ) : has3D && view === "flat" ? (
            // The pattern piece. The garment, cut open and laid out - and genuinely
            // useful: buyers want to see the print flat, and the 3D cannot show it.
            <div className="pattern-piece grid aspect-square place-items-center rounded-brand p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={textureUrl as string}
                alt={`${name}, the classic clothing template`}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : thumbnailUrl ? (
            // The common case: no template on file, so no WebGL at all. Roblox's own
            // render, on the SAME plinth, with the same crop marks, the same contact
            // shadow and the same ink sweep. It is not the sad version of the page -
            // the plinth is the design, not the canvas, so a product with 3D and a
            // product without are not two different websites.
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbnailUrl}
                alt={name}
                className="aspect-square w-full object-contain"
              />
              <div className="plinth-shadow" aria-hidden />
            </div>
          ) : (
            // Nothing at all. A shirt whose print has not come back from the press.
            <div className="panel-paper grid aspect-square place-items-center rounded-brand p-8">
              <p className="display text-center text-4xl leading-none text-paper-ink/[0.18]">
                {name}
              </p>
              <Stamp className="absolute text-paper-ink">Awaiting artwork</Stamp>
            </div>
          )}
        </div>
      </InkSweep>

      {/* What you are looking at, and how to change it. */}
      <div className="mt-4 flex items-center justify-between gap-4">
        {has3D ? (
          <div
            role="tablist"
            aria-label="View"
            className="flex gap-1"
            onKeyDown={(e) => {
              const i = tabs.findIndex((t) => t.id === view);
              if (e.key === "ArrowRight") {
                e.preventDefault();
                setView(tabs[(i + 1) % tabs.length].id);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                setView(tabs[(i - 1 + tabs.length) % tabs.length].id);
              }
            }}
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={view === t.id}
                tabIndex={view === t.id ? 0 : -1}
                onClick={() => setView(t.id)}
                className={cn(
                  "rounded-brand border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors",
                  view === t.id
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line text-muted hover:text-fg",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : (
          <span className="pill">
            {thumbnailUrl ? "Flat view · Roblox render" : "No artwork yet"}
          </span>
        )}

        <p className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-faint sm:block">
          R6 &middot; {kind}
        </p>
      </div>
    </div>
  );
}

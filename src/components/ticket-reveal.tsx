"use client";

import { useEffect, useRef } from "react";
import { TicketQR } from "./ticket-qr";
import { partnerBySlug } from "@/lib/partners/registry";

// RNL's burst: the accent, its lift, bone, and two warm sparks.
const RNL_CONFETTI = ["#2b6bff", "#7aa2ff", "#ece9e1", "#ffd166", "#ff5d73"];

/**
 * Confetti is painted to a <canvas>, which cannot read a CSS variable — so
 * unlike everything else on the page, these colours have to be literal. They
 * come from the partner preset, found via the `data-brand` the root layout put
 * on <html>.
 */
function confettiColors(): readonly string[] {
  const slug = document.documentElement.dataset.brand || null;
  return partnerBySlug(slug)?.confetti ?? RNL_CONFETTI;
}

// Self-contained confetti burst on a full-screen canvas — no dependencies.
function fireConfetti() {
  if (typeof window === "undefined") return;
  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (prefersReduced) return;

  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const resize = () => {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize);

  const colors = confettiColors();
  const W = () => window.innerWidth;
  const H = () => window.innerHeight;

  type P = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    rot: number;
    vr: number;
    size: number;
    color: string;
  };

  const parts: P[] = [];
  const burst = (originX: number) => {
    for (let i = 0; i < 90; i++) {
      const angle = Math.random() * Math.PI - Math.PI / 2;
      const speed = 6 + Math.random() * 9;
      parts.push({
        x: originX,
        y: H() * 0.32,
        vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
        vy: Math.sin(angle) * speed - 4,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        size: 5 + Math.random() * 7,
        color: colors[(Math.random() * colors.length) | 0],
      });
    }
  };
  burst(W() * 0.5);
  setTimeout(() => burst(W() * 0.5), 180);

  let frame = 0;
  const gravity = 0.32;
  const tick = () => {
    frame++;
    ctx.clearRect(0, 0, W(), H());
    for (const p of parts) {
      p.vy += gravity;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
      ctx.restore();
    }
    if (frame < 220) {
      requestAnimationFrame(tick);
    } else {
      window.removeEventListener("resize", resize);
      canvas.remove();
    }
  };
  requestAnimationFrame(tick);
}

export function TicketReveal({
  code,
  justActivated = false,
}: {
  code: string;
  justActivated?: boolean;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (justActivated && !fired.current) {
      fired.current = true;
      const t = setTimeout(fireConfetti, 120);
      return () => clearTimeout(t);
    }
  }, [justActivated]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative rounded-2xl bg-elev p-4 ring-1 ring-accent/30 shadow-[0_0_60px_-15px_rgb(var(--accent-rgb)/0.6)]">
        <TicketQR code={code} size={200} />
        {/* corner brackets for a "scanner" feel */}
        <span className="pointer-events-none absolute left-1.5 top-1.5 h-4 w-4 border-l-2 border-t-2 border-accent/60" />
        <span className="pointer-events-none absolute right-1.5 top-1.5 h-4 w-4 border-r-2 border-t-2 border-accent/60" />
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 h-4 w-4 border-b-2 border-l-2 border-accent/60" />
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 h-4 w-4 border-b-2 border-r-2 border-accent/60" />
      </div>
      <p className="mt-4 font-mono text-lg font-semibold tracking-[0.25em] text-fg">
        {code}
      </p>
      <p className="mt-1 text-xs text-faint">
        Show this at the door · verified in-experience
      </p>
    </div>
  );
}
